import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  // Pad to multiple of 8
  while (output.length % 8 !== 0) output += "=";
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx < 0) throw new Error("Ungültiges Base32-Zeichen.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCounter(nowMs: number = Date.now(), stepSeconds = 30): number {
  return Math.floor(nowMs / 1000 / stepSeconds);
}

export function totpCode(secretBase32: string, counter?: number): string {
  const c = counter ?? totpCounter();
  const secret = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  // write 64-bit counter big-endian
  let x = c;
  for (let i = 7; i >= 0; i--) {
    buf[i] = x & 0xff;
    x = Math.floor(x / 256);
  }
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

export type TotpVerifyResult = { valid: boolean; counter: number };

export function verifyTotp(secretBase32: string, code: string, lastCounter: number | null): TotpVerifyResult {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { valid: false, counter: -1 };
  const now = totpCounter();
  // Check current and adjacent windows (±1 step = 90s tolerance)
  for (let w = -1; w <= 1; w++) {
    const counter = now + w;
    if (lastCounter !== null && counter <= lastCounter) continue;
    if (totpCode(secretBase32, counter) === code) {
      return { valid: true, counter };
    }
  }
  return { valid: false, counter: -1 };
}

export function otpauthUri(secretBase32: string, email: string, issuer = "Maurer Events"): string {
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret: secretBase32.replace(/=+$/, ""),
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

// Recovery codes: 10-char, grouped for readability.
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code).replace(/-/g, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}