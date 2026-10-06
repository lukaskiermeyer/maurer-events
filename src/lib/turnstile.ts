import { BookingError, UUID_PATTERN } from './reservation-policy';

export async function verifyTurnstile(token: unknown, action: string, idempotencyKey?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new BookingError('Spam-Schutz ist nicht konfiguriert.', 503, 'captcha-secret-missing');
  if (typeof token !== 'string' || !token || token.length > 2048) throw new BookingError('Bitte bestätige, dass du kein Roboter bist.');
  const body = new URLSearchParams({ secret, response: token });
  if (idempotencyKey && UUID_PATTERN.test(idempotencyKey)) body.set('idempotency_key', idempotencyKey);
  let hostname: string;
  try {
    hostname = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').hostname;
  } catch {
    throw new BookingError('Spam-Schutz ist nicht korrekt konfiguriert.', 503, 'captcha-url-invalid');
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503, `captcha-service-http-${response.status}`);
    const result = await response.json().catch(() => { throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503, 'captcha-response-invalid'); });
    if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503, 'captcha-response-invalid');
    if (result.success !== true) {
      const invalidSecret = Array.isArray(result['error-codes']) && result['error-codes'].some((code: unknown) => code === 'missing-input-secret' || code === 'invalid-input-secret' || code === 'invalid-widget-id' || code === 'invalid-parsed-secret');
      throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, invalidSecret ? 'captcha-secret-invalid' : 'captcha-rejected');
    }
    if (result.hostname !== hostname) throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, 'captcha-hostname-mismatch');
    if (result.action !== action) throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, 'captcha-action-mismatch');
  } catch (error) {
    if (error instanceof BookingError) throw error;
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    // Emit only known transport labels, never messages, request bodies or keys.
    const causeCode = error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause ? error.cause.code : undefined;
    const transportCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID']);
    const reason = timeout ? 'captcha-service-timeout' : typeof causeCode === 'string' && transportCodes.has(causeCode) ? `captcha-service-network-${causeCode}` : 'captcha-service-network';
    throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503, reason);
  }
}
