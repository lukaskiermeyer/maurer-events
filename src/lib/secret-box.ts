import crypto from "node:crypto";

// AES-256-GCM encryption for at-rest secrets (TOTP).
// Schluessel: TOTP_ENC_KEY (eigenstaendig, getrennt von AUTH_PEPPER/AUTH_SECRET).
// Legacy-Blobs (vor 2026-11-19 aus AUTH_SECRET abgeleitet) bleiben lesbar,
// damit das bestehende TOTP des Dev-Accounts erhalten bleibt; neu verschluesselt
// wird immer mit TOTP_ENC_KEY (bzw. Legacy-Ableitung, falls das Env fehlt).
function keyFromRaw(raw: string, prefix: string): Buffer {
  return crypto.createHash("sha256").update(`${prefix}${raw}`).digest();
}

function newKey(): Buffer {
  const k = process.env.TOTP_ENC_KEY;
  if (!k) return legacyKey();
  if (k.length < 32) throw new Error("TOTP_ENC_KEY ist nicht korrekt konfiguriert (mindestens 32 Zeichen).");
  return keyFromRaw(k, "totp-enc:");
}

function legacyKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ist nicht korrekt konfiguriert.");
  return keyFromRaw(secret, "totp:");
}

function candidateKeys(): Buffer[] {
  const keys: Buffer[] = [];
  if (process.env.TOTP_ENC_KEY) keys.push(newKey());
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) keys.push(legacyKey());
  if (keys.length === 0) throw new Error("Weder TOTP_ENC_KEY noch AUTH_SECRET konfiguriert.");
  return keys;
}

function encryptWith(key: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptWith(key: Buffer, ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < 12 + 16) throw new Error("Ungültiges Secret.");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function encryptSecret(plaintext: string): string {
  return encryptWith(newKey(), plaintext);
}

export function decryptSecret(ciphertext: string): string {
  let lastError: unknown = null;
  for (const key of candidateKeys()) {
    try {
      return decryptWith(key, ciphertext);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Ungültiges Secret.");
}
