import crypto from "node:crypto";

function key() {
  const raw = process.env.STAFF_DATA_KEY;
  if (!raw || raw.length < 32) throw new Error("STAFF_DATA_KEY ist nicht korrekt konfiguriert.");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("v1:")) throw new Error("Verschlüsseltes Feld ist ungültig.");
  const [, ivPart, tagPart, dataPart] = value.split(":");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Verschlüsseltes Feld ist ungültig.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]).toString("utf8");
}

export function maskField(value: string | null | undefined, visible = 4): string {
  const plain = decryptField(value);
  if (!plain) return "—";
  if (plain.length <= visible) return "•".repeat(plain.length);
  return `${"•".repeat(Math.min(12, plain.length - visible))}${plain.slice(-visible)}`;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}