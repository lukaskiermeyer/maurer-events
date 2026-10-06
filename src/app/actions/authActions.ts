"use server";
import { randomInt } from 'node:crypto';
import { db } from '@/db';
import { adminAuth, adminSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { verifyTurnstile } from '@/lib/turnstile';
import { takeRateLimit } from '@/lib/rate-limit';
import { isAdminEmail, otpHash } from '@/lib/admin-identity';
import { guestDetails, UUID_PATTERN } from '@/lib/reservation-policy';
import { consumeAdminOtp } from '@/lib/admin-otp';

export async function requestOtp(email: string, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`otp-request:${normalizedEmail}`, 5, 15 * 60000)) return { success: false, error: 'Zu viele Anfragen. Bitte warte 15 Minuten.' };
    if (!isAdminEmail(normalizedEmail)) return { success: true };
    if (!process.env.RESEND_API_KEY) return { success: false, error: 'E-Mail-Versand ist nicht konfiguriert.' };
    const code = randomInt(100000, 1000000).toString();
    const hashed = otpHash(normalizedEmail, code);
    await db.insert(adminAuth).values({ email: normalizedEmail, otpCode: hashed, attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000) })
      .onConflictDoUpdate({ target: adminAuth.email, set: { otpCode: hashed, attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000) } });
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'Maurer Events Admin <servus@maurer-events.com>', to: [normalizedEmail], subject: 'Dein Admin Login-Code', html: `<p>Dein einmaliger Login-Code: <strong>${code}</strong></p><p>Gültig für 10 Minuten.</p>` });
    if (result.error) throw new Error('Email unavailable');
    return { success: true };
  } catch { return { success: false, error: 'Anmeldecode konnte nicht angefordert werden.' }; }
}

export async function verifyOtp(email: string, code: string, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { success: false, error: 'Ungültiger Code.' };
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`otp-verify:${normalizedEmail}`, 10, 15 * 60000)) return { success: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' };
    if (!isAdminEmail(normalizedEmail)) return { success: false, error: 'Code ungültig oder abgelaufen.' };
    const session = await consumeAdminOtp(db, normalizedEmail, code);
    if (!session) return { success: false, error: 'Code ungültig, abgelaufen oder bereits verwendet.' };
    (await cookies()).set('admin_token', session.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', expires: session.validUntil, path: '/' });
    return { success: true };
  } catch { return { success: false, error: 'Anmeldung vorübergehend nicht verfügbar.' }; }
}

export async function logout() {
  const store = await cookies();
  const token = store.get('admin_token')?.value;
  if (token && UUID_PATTERN.test(token)) await db.delete(adminSessions).where(eq(adminSessions.id, token));
  store.delete('admin_token');
  return { success: true };
}

export async function devBypassLogin() {
  // Explicit local opt-in; development deployments are otherwise protected too.
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEV_LOGIN !== 'true') return { success: false, error: 'Development login is disabled.' };
  const email = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase();
  if (!email || !isAdminEmail(email)) return { success: false, error: 'No administrator configured.' };
  const validUntil = new Date(Date.now() + 86400000);
  const [session] = await db.insert(adminSessions).values({ email, validUntil }).returning();
  (await cookies()).set('admin_token', session.id, { httpOnly: true, secure: false, sameSite: 'strict', expires: validUntil, path: '/' });
  return { success: true };
}
