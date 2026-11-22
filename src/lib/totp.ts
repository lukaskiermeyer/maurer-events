import crypto from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { hmacSha256, pepper } from "./admin-crypto";

// RFC 6238 via otpauth (gepflegte Bibliothek, keine Eigenimplementierung):
// SHA-1 (Kompatibilität Google Authenticator), 6 Ziffern, 30 s, ±1 Step Drift.
export const TOTP_ISSUER = "Maurer Events Admin";

export function generateTotpSecret(): string {
  // 20 Byte CSPRNG, base32
  return new Secret({ size: 20 }).base32;
}

export function totpCounter(nowMs: number = Date.now(), stepSeconds = 30): number {
  return Math.floor(nowMs / 1000 / stepSeconds);
}

function instance(secretBase32: string) {
  return new TOTP({ secret: Secret.fromBase32(secretBase32), algorithm: "SHA1", digits: 6, period: 30 });
}

export function totpCode(secretBase32: string, counter?: number): string {
  const c = counter ?? totpCounter();
  return instance(secretBase32).generate({ timestamp: c * 30 * 1000 });
}

export type TotpVerifyResult = { valid: boolean; counter: number };

export function verifyTotp(secretBase32: string, code: string, lastCounter: number | null): TotpVerifyResult {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { valid: false, counter: -1 };
  const delta = instance(secretBase32).validate({ token: code, window: 1 });
  if (delta === null) return { valid: false, counter: -1 };
  const counter = totpCounter() + delta;
  // Replay-Schutz: bereits verwendete Steps ablehnen.
  if (lastCounter !== null && counter <= lastCounter) return { valid: false, counter: -1 };
  return { valid: true, counter };
}

export function otpauthUri(secretBase32: string, email: string, issuer = TOTP_ISSUER): string {
  const totp = new TOTP({
    issuer,
    label: `(${email})`,
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.toString();
}

// Recovery codes: 10 Stück, 10 Zeichen, gruppiert; HMAC-gehasht (single-use).
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return String(code || "").trim().toUpperCase().replace(/[\s-]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return hmacSha256(pepper(), normalizeRecoveryCode(code));
}

// Altes Schema (vor Passwort/TOTP-Umstellung): SHA-256 ohne Key.
// Bleibt für migrierte Bestands-Codes als Fallback gültig.
export function hashRecoveryCodeLegacy(code: string): string {
  return crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}
