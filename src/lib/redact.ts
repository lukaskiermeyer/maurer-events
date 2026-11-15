// Zentraler Redactor für Log-Ausgaben. Verhindert, dass personenbezogene Daten
// (Namen, E-Mails, Telefonnummern, Tokens, signed URLs, Query-Strings) in
// App-/Traefik-/Docker-Logs landen. Wird von allen console.*-Aufrufen und vom
// Error-Tracking (Sentry o. ä.) genutzt.
//
// Regeln (verbindlich):
// 1. E-Mails: nur Domain behalten, lokaler Teil maskiert (a***@example.com).
// 2. Telefonnummern: nur letzte 4 Ziffern sichtbar, Rest mit X.
// 3. Namen: nur Initialen (z. B. "M. M.").
// 4. Tokens/Secrets/Signaturen: vollständig maskiert ("[REDACTED]").
// 5. URLs: Query-String und Fragment entfernen; signed URLs (s--, token, sig,
//    signature, access_token, api_key, secret) vollständig maskieren.
// 6. Request-Bodies: niemals loggen; stattdessen nur Länge + Content-Type.
// 7. Fehlerobjekte: nur name + (gekürzte) message, kein Stack mit Daten.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;
const TOKEN_QUERY_RE = /(token|sig|signature|s--|access_token|api_key|secret|key)=([^&\s]+)/gi;
const SIGNED_URL_RE = /(https?:\/\/[^\s"'<>]+(?:s--[^/]+--|token=|sig=|signature=)[^\s"'<>]*)/gi;

export function redactEmail(value: string): string {
  return value.replace(EMAIL_RE, (m) => {
    const [local, domain] = m.split("@");
    if (!domain) return "[email]";
    const head = local.length > 0 ? local[0] : "*";
    return `${head}***@${domain}`;
  });
}

export function redactPhone(value: string): string {
  return value.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 4) return "[phone]";
    const tail = digits.slice(-4);
    return `XXX-XXX-${tail}`;
  });
}

export function redactToken(value: string): string {
  return value
    .replace(TOKEN_QUERY_RE, "$1=[REDACTED]")
    .replace(SIGNED_URL_RE, "[signed-url-redacted]");
}

export function redactUrl(value: string): string {
  try {
    const u = new URL(value);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return redactToken(value);
  }
}

export function redactName(value: string): string {
  // "Max Mustermann" -> "M. M."
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0) return "[name]";
  return parts.map((p) => (p[0] ? `${p[0].toUpperCase()}.` : "")).join(" ");
}

export function redactError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactToken(redactEmail(err.message)).slice(0, 500),
    };
  }
  return { name: "UnknownError", message: "[redacted]" };
}

export function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return redactToken(redactPhone(redactEmail(value)));
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      if (
        lk.includes("password") ||
        lk.includes("secret") ||
        lk.includes("token") ||
        lk.includes("signature") ||
        lk.includes("apikey") ||
        lk.includes("api_key") ||
        lk.includes("authorization") ||
        lk.includes("cookie") ||
        lk.includes("email") ||
        lk.includes("phone") ||
        lk.includes("name") ||
        lk.includes("iban") ||
        lk.includes("taxid") ||
        lk.includes("tax_id") ||
        lk.includes("socialsecurity") ||
        lk.includes("social_security")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

// Convenience: loggt strukturiert und redacted.
export function safeLog(...args: unknown[]): void {
  console.log(...args.map((a) => (typeof a === "object" ? redact(a) : a)));
}

export function safeError(...args: unknown[]): void {
  console.error(...args.map((a) => (typeof a === "object" ? redact(a) : a)));
}

export function safeWarn(...args: unknown[]): void {
  console.warn(...args.map((a) => (typeof a === "object" ? redact(a) : a)));
}
