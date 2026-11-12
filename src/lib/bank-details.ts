import { BookingError } from "./reservation-policy";

export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

// ISO 13616 MOD-97. Operates on the rearranged alphanumeric string
// without requiring BigInt (safe for long IBANs).
export function ibanMod97(value: string): number {
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      remainder = (remainder * 10 + (code - 48)) % 97;
    } else {
      // A=10 ... Z=35 (two digits).
      const numeric = code - 55;
      remainder = (remainder * 100 + numeric) % 97;
    }
  }
  return remainder;
}

export function isValidIban(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const iban = normalizeIban(value);
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
  return ibanMod97(iban) === 1;
}

export function isValidBic(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const bic = value.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
}

export function normalizeBic(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function ibanField(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BookingError("Ungültige IBAN.");
  const iban = normalizeIban(value);
  if (!iban) return null;
  if (!isValidIban(iban)) throw new BookingError("Ungültige IBAN.");
  return iban;
}

export function bicField(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BookingError("Ungültige BIC.");
  const bic = normalizeBic(value);
  if (!bic) return null;
  if (!isValidBic(bic)) throw new BookingError("Ungültige BIC.");
  return bic;
}

export function taxIdField(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BookingError("Ungültige Steuer-ID.");
  const taxId = value.replace(/[\s-]/g, "");
  if (!taxId) return null;
  if (!/^\d{11}$/.test(taxId)) throw new BookingError("Ungültige Steuer-ID.");
  return taxId;
}
