import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminEnrollmentTokens } from "@/db/schema";
import { randomToken, hmacSha256, pepper, timingSafeEqualHex, sha256Hex, randomCrockford, formatCrockford, normalizeCrockford } from "./admin-crypto";
import { decryptSecret, encryptSecret } from "./secret-box";

export type EnrollmentPurpose = "invite" | "password_reset" | "totp_reset";

export interface EnrollmentTokenResult {
  rawToken: string;
  pin: string | null; // formatiert XXXX-XXXX, nur bei invite
  pinRaw: string | null;
  tokenId: string;
  expiresAt: Date;
}

export const ENROLLMENT_TTL_MS: Record<EnrollmentPurpose, number> = {
  invite: 72 * 3600 * 1000,
  password_reset: 60 * 60 * 1000,
  totp_reset: 30 * 60 * 1000,
};

export async function createEnrollmentToken(params: {
  adminId: string;
  purpose: EnrollmentPurpose;
  ttlMs?: number;
  createdBy?: string | null;
  createdVia: "cli" | "ui";
}): Promise<EnrollmentTokenResult> {
  // Offene Tokens desselben Zwecks vorher entwerten.
  await db.update(adminEnrollmentTokens)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(adminEnrollmentTokens.adminId, params.adminId),
      eq(adminEnrollmentTokens.purpose, params.purpose),
      isNull(adminEnrollmentTokens.consumedAt),
    ));

  const rawToken = randomToken(32);
  const tokenHashSha = sha256Hex(rawToken);

  // PIN nur out-of-band bei invite; Resets laufen ohne PIN (Mail-Link + TOTP-Pflicht).
  let pinFormatted: string | null = null;
  let pinRaw: string | null = null;
  let pinHash: string | null = null;
  if (params.purpose === "invite") {
    const pin8 = randomCrockford(8);
    pinFormatted = formatCrockford(pin8, 4);
    pinRaw = pin8;
    pinHash = hmacSha256(pepper(), pin8);
  }

  const expiresAt = new Date(Date.now() + (params.ttlMs ?? ENROLLMENT_TTL_MS[params.purpose]));
  const [row] = await db.insert(adminEnrollmentTokens).values({
    adminId: params.adminId,
    tokenHash: tokenHashSha,
    pinHash,
    purpose: params.purpose,
    expiresAt,
    createdBy: params.createdBy ?? null,
    createdVia: params.createdVia,
  }).returning();

  return { rawToken, pin: pinFormatted, pinRaw, tokenId: row.id, expiresAt };
}

export async function validateEnrollmentToken(params: {
  rawToken: string;
  pin?: string | null;
}): Promise<{ ok: boolean; tokenId?: string; adminId?: string; purpose?: EnrollmentPurpose; reason?: string }> {
  const tokenHash = sha256Hex(params.rawToken);
  const rows = await db.select().from(adminEnrollmentTokens)
    .where(and(eq(adminEnrollmentTokens.tokenHash, tokenHash), isNull(adminEnrollmentTokens.consumedAt)));
  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_or_used" };
  if (row.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  if (row.pinAttempts >= 5) return { ok: false, reason: "burned" };

  if (row.pinHash) {
    const pinNorm = normalizeCrockford(params.pin || "");
    // Nur echte PIN-Eingaben zählen als Versuch: Seiten-Loads (ohne PIN) und
    // erfolgreiche Validates verbrennen sonst das 5-Versuche-Budget des Wizards.
    if (!pinNorm) return { ok: false, reason: "bad_pin" };
    const pinHash = hmacSha256(pepper(), pinNorm);
    const match = timingSafeEqualHex(pinHash, row.pinHash);
    if (!match) {
      const attempts = row.pinAttempts + 1;
      await db.update(adminEnrollmentTokens)
        .set({ pinAttempts: attempts })
        .where(eq(adminEnrollmentTokens.id, row.id));
      if (attempts >= 5) {
        await db.update(adminEnrollmentTokens).set({ consumedAt: new Date() }).where(eq(adminEnrollmentTokens.id, row.id));
      }
      return { ok: false, reason: "bad_pin" };
    }
  }
  return { ok: true, tokenId: row.id, adminId: row.adminId, purpose: row.purpose as EnrollmentPurpose };
}

export async function findEnrollmentTokenByRaw(rawToken: string) {
  const tokenHash = sha256Hex(rawToken);
  const rows = await db.select().from(adminEnrollmentTokens)
    .where(eq(adminEnrollmentTokens.tokenHash, tokenHash));
  return rows[0] ?? null;
}

// Nur der erste Verbrauch darf weitere Tokens des Admins entwerten.
export async function consumeEnrollmentToken(tokenId: string): Promise<boolean> {
  const [claimed] = await db.update(adminEnrollmentTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(adminEnrollmentTokens.id, tokenId), isNull(adminEnrollmentTokens.consumedAt)))
    .returning({ adminId: adminEnrollmentTokens.adminId, purpose: adminEnrollmentTokens.purpose });
  if (!claimed) return false;
  if (claimed.purpose !== "invite") {
    await db.update(adminEnrollmentTokens)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(adminEnrollmentTokens.adminId, claimed.adminId),
        isNull(adminEnrollmentTokens.consumedAt),
      ));
  }
  return true;
}

// Pending-TOTP-Secret für den Setup-Wizard (lebt am Token, 15 min gültig).
export async function setPendingTotp(tokenId: string, secretBase32: string): Promise<void> {
  await db.update(adminEnrollmentTokens)
    .set({ pendingTotpEnc: encryptSecret(secretBase32), pendingTotpAt: new Date() })
    .where(eq(adminEnrollmentTokens.id, tokenId));
}

export async function getPendingTotp(tokenId: string): Promise<string | null> {
  const [row] = await db.select().from(adminEnrollmentTokens).where(eq(adminEnrollmentTokens.id, tokenId));
  if (!row?.pendingTotpEnc || !row.pendingTotpAt) return null;
  if (row.pendingTotpAt.getTime() < Date.now() - 15 * 60000) return null;
  try {
    return decryptSecret(row.pendingTotpEnc);
  } catch {
    return null;
  }
}
