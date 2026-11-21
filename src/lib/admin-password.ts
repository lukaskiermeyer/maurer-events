import crypto from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// OWASP-Baseline für Argon2id: m=19456 KiB, t=2, p=1.
// hash-wasm (WASM) statt nativer Bindings: Deployment läuft auf node:22-alpine
// (musl) mit Next-Standalone-Tracing – keine nativen Build-/Trace-Probleme.
export const ARGON2_PARAMS = {
  memorySizeKiB: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySizeKiB,
    hashLength: ARGON2_PARAMS.hashLength,
    outputType: "encoded",
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ hash, password });
  } catch {
    return false;
  }
}

// Timing-Angleich: bei unbekannter E-Mail trotzdem gegen einen Dummy-Hash prüfen.
let dummyHash: string | null = null;
export async function verifyPasswordDummy(password: string): Promise<void> {
  if (!dummyHash) dummyHash = await hashPassword("timing-ausgleich-dummy");
  await argon2Verify({ hash: dummyHash, password }).catch(() => false);
}

export function checkPasswordPolicy(password: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`;
  }
  // Nicht abschneiden: zu lange Passwörter werden explizit abgelehnt.
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`;
  }
  return null;
}

// HIBP-Breach-Check über k-Anonymity: nur die ersten 5 SHA-1-Zeichen verlassen uns.
// Bei Timeout/Feehler: fail-open + Log.
export async function isBreachedPassword(password: string): Promise<boolean> {
  const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { "User-Agent": "maurer-events-admin-password-check" },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split(/\r?\n/).some(line => line.split(":")[0] === suffix);
  } catch {
    console.error("HIBP-Check nicht erreichbar – fail-open.");
    return false;
  } finally {
    clearTimeout(timer);
  }
}
