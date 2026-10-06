import { BookingError, UUID_PATTERN } from './reservation-policy';

export async function verifyTurnstile(token: unknown, action: string, idempotencyKey?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new BookingError('Spam-Schutz ist nicht konfiguriert.', 503);
  if (typeof token !== 'string' || !token || token.length > 2048) throw new BookingError('Bitte bestätige, dass du kein Roboter bist.');
  const body = new URLSearchParams({ secret, response: token });
  if (idempotencyKey && UUID_PATTERN.test(idempotencyKey)) body.set('idempotency_key', idempotencyKey);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Security service unavailable');
    const result = await response.json();
    const hostname = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').hostname;
    if (result.success !== true) {
      const invalidSecret = Array.isArray(result['error-codes']) && result['error-codes'].some((code: unknown) => code === 'missing-input-secret' || code === 'invalid-input-secret' || code === 'invalid-widget-id' || code === 'invalid-parsed-secret');
      throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, invalidSecret ? 'captcha-secret-invalid' : 'captcha-rejected');
    }
    if (result.hostname !== hostname) throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, 'captcha-hostname-mismatch');
    if (result.action !== action) throw new BookingError('Spam-Schutz fehlgeschlagen.', 400, 'captcha-action-mismatch');
  } catch (error) {
    if (error instanceof BookingError) throw error;
    throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503);
  }
}
