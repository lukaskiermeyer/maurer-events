import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { BookingError } from './reservation-policy';

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}

// Prüft Umgebungsvariable ODER Datenbank (Admins, die im Admin-Bereich angelegt wurden).
export async function isAdminEmailWithDb(connection: typeof db, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (isAdminEmail(normalized)) return true;
  const [row] = await connection.select({ id: adminUsers.id }).from(adminUsers)
    .where(sql`lower(trim(${adminUsers.email})) = ${normalized}`);
  return !!row;
}
export function otpHash(email: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new BookingError('Anmeldung ist nicht konfiguriert.', 503);
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}
