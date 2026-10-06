import { createHmac } from 'node:crypto';
import { BookingError } from './reservation-policy';

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}
export function otpHash(email: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new BookingError('Anmeldung ist nicht konfiguriert.', 503);
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}
