import crypto from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminRecoveryCodes, adminTrustedDevices, adminUsers } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./secret-box";
import { generateRecoveryCodes, hashRecoveryCodeLegacy } from "./totp";
import { consumeRecoveryCode, countRecoveryCodes, storeRecoveryCodes } from "./admin-recovery";
import { hashToken } from "./admin-crypto";

export type AdminRow = typeof adminUsers.$inferSelect;

export async function getAdminByEmail(email: string): Promise<AdminRow | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db.select().from(adminUsers)
    .where(sql`lower(trim(${adminUsers.email})) = ${normalized}`);
  return row || null;
}

export function isTotpEnabled(admin: AdminRow | null): boolean {
  return !!admin && !!admin.totpSecretEnc && !!admin.totpEnrolledAt;
}

// Login nur mit Passwort + TOTP + status active.
export function canLoginWithPassword(admin: AdminRow | null): boolean {
  return !!admin && admin.status === "active" && !!admin.passwordSetAt && isTotpEnabled(admin);
}

export function getTotpSecret(admin: AdminRow | null): string | null {
  if (!admin || !admin.totpSecretEnc) return null;
  try {
    return decryptSecret(Buffer.from(admin.totpSecretEnc).toString("base64"));
  } catch {
    return null;
  }
}

export async function updateLastStep(adminId: string, step: number): Promise<void> {
  await db.update(adminUsers)
    .set({ totpLastUsedStep: step, updatedAt: new Date() })
    .where(eq(adminUsers.id, adminId));
}

export async function enableTotp(adminId: string, secretBase32: string): Promise<{ recoveryCodes: string[] }> {
  const recoveryCodes = generateRecoveryCodes(10);
  const enc = encryptSecret(secretBase32);
  await db.update(adminUsers).set({
    totpSecretEnc: Buffer.from(enc, "base64"),
    totpEnrolledAt: new Date(),
    totpLastUsedStep: null,
    updatedAt: new Date(),
  }).where(eq(adminUsers.id, adminId));
  await storeRecoveryCodes(adminId, recoveryCodes);
  return { recoveryCodes };
}

export async function disableTotp(adminId: string): Promise<void> {
  await db.update(adminUsers).set({
    totpSecretEnc: null,
    totpEnrolledAt: null,
    totpLastUsedStep: null,
    updatedAt: new Date(),
  }).where(eq(adminUsers.id, adminId));
}

export async function setPasswordHash(adminId: string, hash: string): Promise<void> {
  await db.update(adminUsers).set({
    passwordHash: hash,
    passwordSetAt: new Date(),
    failedPasswordAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date(),
  }).where(eq(adminUsers.id, adminId));
}

// Recovery-Code einlösen: aktuelles HMAC-Schema, Fallback für migrierte SHA-256-Codes.
export async function consumeRecoveryCodeForAdmin(adminId: string, code: string): Promise<boolean> {
  if (await consumeRecoveryCode(adminId, code)) return true;
  const legacyHash = hashRecoveryCodeLegacy(code);
  const [row] = await db.select().from(adminRecoveryCodes)
    .where(and(eq(adminRecoveryCodes.adminId, adminId), eq(adminRecoveryCodes.codeHash, legacyHash), isNull(adminRecoveryCodes.consumedAt)));
  if (!row) return false;
  await db.update(adminRecoveryCodes).set({ consumedAt: new Date() }).where(eq(adminRecoveryCodes.id, row.id));
  return true;
}

export { countRecoveryCodes };

// ---------------- Trusted Devices ("Dieses Gerät 30 Tage merken") ----------------
// Überspringt NUR TOTP, nie das Passwort. Token gehasht, an Session gebunden,
// rotierend, Widerruf bei Passwort-Change/-Reset.
const TRUSTED_DEVICE_DAYS = 30;

function deviceFingerprint(req: { userAgent?: string | null; ip?: string | null }): string {
  return `${req.userAgent || ""}|${(req.ip || "").split(".").slice(0, 3).join(".")}`;
}

export async function createTrustedDevice(
  email: string,
  req: { userAgent?: string | null; ip?: string | null },
  sessionToken: string,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 86400000);
  await db.insert(adminTrustedDevices).values({
    email: normalized,
    tokenHash: hash,
    fingerprint: deviceFingerprint(req),
    sessionHash: hashToken(sessionToken),
    expiresAt,
  });
  return raw;
}

export async function findTrustedDevice(
  rawToken: string,
  email: string,
  req: { userAgent?: string | null; ip?: string | null },
): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [row] = await db.select().from(adminTrustedDevices)
    .where(and(eq(adminTrustedDevices.tokenHash, hash), eq(adminTrustedDevices.email, normalized), gt(adminTrustedDevices.expiresAt, new Date())));
  if (!row) return null;
  if (row.fingerprint && row.fingerprint !== deviceFingerprint(req)) return null;
  await db.update(adminTrustedDevices).set({ lastUsedAt: new Date() }).where(eq(adminTrustedDevices.id, row.id));
  return { id: row.id };
}

// Rotation: neuer Token + Bindung an die frische Session, alter Token ungültig.
export async function rotateTrustedDevice(deviceId: string, sessionToken: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  await db.update(adminTrustedDevices)
    .set({ tokenHash: hash, sessionHash: hashToken(sessionToken) })
    .where(eq(adminTrustedDevices.id, deviceId));
  return raw;
}

export async function revokeTrustedDevices(email: string): Promise<void> {
  await db.delete(adminTrustedDevices).where(eq(adminTrustedDevices.email, email.trim().toLowerCase()));
}

export { deviceFingerprint };
