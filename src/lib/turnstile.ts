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
    if (result.success !== true || result.hostname !== hostname || result.action !== action) throw new BookingError('Spam-Schutz fehlgeschlagen.');
  } catch (error) {
    if (error instanceof BookingError) throw error;
    throw new BookingError('Verbindungsfehler beim Spam-Schutz.', 503);
  }
}
