import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { adminMfa, adminTrustedDevices } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./secret-box";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode } from "./totp";

export type AdminMfaRow = typeof adminMfa.$inferSelect;

export async function getAdminMfa(email: string): Promise<AdminMfaRow | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db.select().from(adminMfa).where(eq(adminMfa.email, normalized));
  return row || null;
}

export async function ensureAdminMfaRow(email: string): Promise<AdminMfaRow> {
  const normalized = email.trim().toLowerCase();
  const existing = await getAdminMfa(normalized);
  if (existing) return existing;
  const [row] = await db.insert(adminMfa).values({ email: normalized }).onConflictDoNothing().returning();
  if (row) return row;
  const again = await getAdminMfa(normalized);
  if (!again) throw new Error("MFA-Zeile konnte nicht angelegt werden.");
  return again;
}

export function isTotpEnabled(row: AdminMfaRow | null): boolean {
  return !!row && !!row.totpSecretEnc && !!row.totpEnabledAt;
}

export async function createPendingTotpSecret(email: string): Promise<{ secret: string; qrSecret: string }> {
  const normalized = email.trim().toLowerCase();
  const secret = generateTotpSecret();
  const enc = encryptSecret(secret);
  await ensureAdminMfaRow(normalized);
  await db.update(adminMfa).set({
    pendingSecretEnc: enc,
    pendingCreatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(adminMfa.email, normalized));
  return { secret, qrSecret: secret.replace(/=+$/, "") };
}

export async function getPendingSecret(email: string): Promise<string | null> {
  const row = await getAdminMfa(email);
  if (!row || !row.pendingSecretEnc || !row.pendingCreatedAt) return null;
  // Pending expires after 15 minutes
  if (row.pendingCreatedAt.getTime() < Date.now() - 15 * 60000) return null;
  try { return decryptSecret(row.pendingSecretEnc); }
  catch { return null; }
}

export async function enableTotp(email: string, pendingSecret: string): Promise<{ recoveryCodes: string[] }> {
  const normalized = email.trim().toLowerCase();
  const recoveryCodes = generateRecoveryCodes(10);
  const hashed = recoveryCodes.map(hashRecoveryCode);
  const enc = encryptSecret(pendingSecret);
  await ensureAdminMfaRow(normalized);
  await db.update(adminMfa).set({
    totpSecretEnc: enc,
    totpEnabledAt: new Date(),
    totpLastCounter: null,
    recoveryCodes: hashed,
    pendingSecretEnc: null,
    pendingCreatedAt: null,
    updatedAt: new Date(),
  }).where(eq(adminMfa.email, normalized));
  return { recoveryCodes };
}

export async function getTotpSecret(email: string): Promise<string | null> {
  const row = await getAdminMfa(email);
  if (!row || !row.totpSecretEnc) return null;
  try { return decryptSecret(row.totpSecretEnc); }
  catch { return null; }
}

export async function updateLastCounter(email: string, counter: number): Promise<void> {
  await db.update(adminMfa).set({ totpLastCounter: counter, updatedAt: new Date() })
    .where(eq(adminMfa.email, email.trim().toLowerCase()));
}

// Recovery codes
export async function consumeRecoveryCode(email: string, code: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const row = await getAdminMfa(normalized);
  if (!row) return false;
  const hash = hashRecoveryCode(code);
  const codes = (row.recoveryCodes as string[] | null) || [];
  if (!codes.includes(hash)) return false;
  const remaining = codes.filter(c => c !== hash);
  await db.update(adminMfa).set({ recoveryCodes: remaining, updatedAt: new Date() })
    .where(eq(adminMfa.email, normalized));
  return true;
}

export async function countRecoveryCodes(email: string): Promise<number> {
  const row = await getAdminMfa(email);
  return ((row?.recoveryCodes as string[] | null) || []).length;
}

// Trusted devices
function deviceFingerprint(req: { userAgent?: string | null; ip?: string | null }): string {
  return `${req.userAgent || ""}|${(req.ip || "").split(".").slice(0, 3).join(".")}`;
}

export async function createTrustedDevice(email: string, req: { userAgent?: string | null; ip?: string | null }): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.insert(adminTrustedDevices).values({
    email: normalized,
    tokenHash: hash,
    fingerprint: deviceFingerprint(req),
    expiresAt,
  });
  return raw;
}

export async function findTrustedDevice(rawToken: string, email: string, req: { userAgent?: string | null; ip?: string | null }): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [row] = await db.select().from(adminTrustedDevices)
    .where(and(eq(adminTrustedDevices.tokenHash, hash), eq(adminTrustedDevices.email, normalized), gt(adminTrustedDevices.expiresAt, new Date())));
  if (!row) return null;
  // Fingerprint check (soft): if mismatch, reject
  if (row.fingerprint && row.fingerprint !== deviceFingerprint(req)) return null;
  await db.update(adminTrustedDevices).set({ lastUsedAt: new Date() }).where(eq(adminTrustedDevices.id, row.id));
  return { id: row.id };
}

export async function revokeTrustedDevices(email: string): Promise<void> {
  await db.delete(adminTrustedDevices).where(eq(adminTrustedDevices.email, email.trim().toLowerCase()));
}

export { deviceFingerprint };