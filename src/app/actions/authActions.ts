"use server";
import { randomInt, timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { adminAuth, adminSessions, adminMfa, adminTrustedDevices } from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { Resend } from 'resend';
import { verifyTurnstile } from '@/lib/turnstile';
import { takeRateLimit } from '@/lib/rate-limit';
import { isAdminEmail, otpHash } from '@/lib/admin-identity';
import { resolveStaffAccess } from '@/lib/staff-access';
import { requireAdmin } from '@/lib/auth';
import { BookingError, guestDetails, UUID_PATTERN } from '@/lib/reservation-policy';
import { emailFrom } from '@/lib/email';
import { renderEmail } from '@/lib/email-template';
import QRCode from 'qrcode';
import {
  getAdminMfa, isTotpEnabled, createPendingTotpSecret, getPendingSecret,
  enableTotp, getTotpSecret, updateLastCounter, consumeRecoveryCode,
  createTrustedDevice, findTrustedDevice, countRecoveryCodes,
} from '@/lib/admin-mfa';
import { verifyTotp, otpauthUri } from '@/lib/totp';

function isProd() { return process.env.NODE_ENV === 'production'; }

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = (h.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 100);
    return forwarded || 'unknown';
  } catch { return 'unknown'; }
}

async function userAgent(): Promise<string | null> {
  try { return (await headers()).get('user-agent'); }
  catch { return null; }
}

export async function requestAdminLogin(email: string, turnstileToken: string) {
  let stage = 'input';
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    stage = 'captcha';
    await verifyTurnstile(turnstileToken, 'admin-login');
    stage = 'rate-limit';
    const ip = await clientIp();
    if (!await takeRateLimit(`admin-login:${normalizedEmail}`, 10, 15 * 60000)) return { success: false, error: 'Zu viele Anfragen. Bitte warte 15 Minuten.' };
    if (!await takeRateLimit(`admin-login-ip:${ip}`, 30, 15 * 60000)) return { success: false, error: 'Zu viele Anfragen. Bitte warte 15 Minuten.' };

    const access = await resolveStaffAccess(db, normalizedEmail);
    const isAdmin = !!access && access.role === 'admin';

    // Trusted device: skip TOTP entirely
    if (isAdmin) {
      try {
        const cookieStore = await cookies();
        const trustedRaw = cookieStore.get('admin_trusted_device')?.value;
        if (trustedRaw) {
          const [tEmail, tToken] = trustedRaw.split('|');
          if (tEmail === normalizedEmail && tToken) {
            const td = await findTrustedDevice(tToken, normalizedEmail, { userAgent: await userAgent(), ip });
            if (td) {
              const validUntil = new Date(Date.now() + 7 * 86400000);
              const [session] = await db.insert(adminSessions).values({ email: normalizedEmail, validUntil }).returning();
              cookieStore.set('admin_token', session.id, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: validUntil, path: '/' });
              return { success: true, step: 'done' as const, destination: '/admin' };
            }
          }
        }
      } catch { /* ignore */ }
    }

    const mfa = isAdmin ? await getAdminMfa(normalizedEmail) : null;
    if (isAdmin && isTotpEnabled(mfa)) {
      return { success: true, step: 'totp' as const };
    }

    // Not enrolled (or not admin): generic totp step for non-admins (no leak),
    // enrollment email-OTP for admins without TOTP.
    if (!isAdmin) {
      return { success: true, step: 'totp' as const };
    }

    if (!process.env.RESEND_API_KEY) return { success: false, error: 'E-Mail-Versand ist nicht konfiguriert.' };
    const code = randomInt(100000, 1000000).toString();
    stage = 'otp-hash';
    const hashed = otpHash(normalizedEmail, code);
    stage = 'otp-save';
    await db.insert(adminAuth).values({ email: normalizedEmail, otpCode: hashed, attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000) })
      .onConflictDoUpdate({ target: adminAuth.email, set: { otpCode: hashed, attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000) } });
    stage = 'email-send';
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: emailFrom(), to: [normalizedEmail],
      subject: 'Dein Admin-Login-Code (2FA-Einrichtung)',
      html: renderEmail({ title: 'Dein Admin-Login-Code', preheader: `Dein Code: ${code}`, blocks: [
        { type: 'paragraph', text: 'Dein einmaliger Login-Code für die 2FA-Einrichtung:' },
        { type: 'heading', text: code },
        { type: 'paragraph', text: 'Gültig für 10 Minuten. Gib den Code nicht weiter.', muted: true },
      ] }),
    });
    if (result.error) throw new Error('Email unavailable');
    return { success: true, step: 'email-otp' as const };
  } catch (error) {
    console.error('Admin login request failed:', { stage, reason: error instanceof BookingError ? error.code || `validation:${error.status}` : 'dependency-unavailable' });
    return { success: false, error: 'Anmeldecode konnte nicht angefordert werden.' };
  }
}

export async function verifyAdminTotp(email: string, code: string, trustDevice: boolean, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { success: false, error: 'Ungültiger Code.' };
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`admin-totp:${normalizedEmail}`, 5, 15 * 60000)) return { success: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' };
    const access = await resolveStaffAccess(db, normalizedEmail);
    if (!access || access.role !== 'admin') return { success: false, error: 'Code ungültig oder abgelaufen.' };
    const mfa = await getAdminMfa(normalizedEmail);
    if (!isTotpEnabled(mfa)) return { success: false, error: '2FA nicht eingerichtet.' };
    const secret = await getTotpSecret(normalizedEmail);
    if (!secret) return { success: false, error: '2FA nicht verfügbar.' };
    const vr = verifyTotp(secret, code, mfa?.totpLastCounter ?? null);
    if (!vr.valid) return { success: false, error: 'Code ungültig oder bereits verwendet.' };
    await updateLastCounter(normalizedEmail, vr.counter);

    const validUntil = new Date(Date.now() + 7 * 86400000);
    const [session] = await db.insert(adminSessions).values({ email: normalizedEmail, validUntil }).returning();
    const cookieStore = await cookies();
    cookieStore.set('admin_token', session.id, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: validUntil, path: '/' });
    if (trustDevice) {
      const raw = await createTrustedDevice(normalizedEmail, { userAgent: await userAgent(), ip: await clientIp() });
      cookieStore.set('admin_trusted_device', `${normalizedEmail}|${raw}`, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: new Date(Date.now() + 7 * 86400000), path: '/' });
    }
    return { success: true, destination: '/admin' };
  } catch { return { success: false, error: 'Anmeldung vorübergehend nicht verfügbar.' }; }
}

export async function verifyAdminRecoveryCode(email: string, code: string, trustDevice: boolean, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    if (typeof code !== 'string' || code.trim().length < 8) return { success: false, error: 'Ungültiger Recovery-Code.' };
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`admin-recovery:${normalizedEmail}`, 5, 15 * 60000)) return { success: false, error: 'Zu viele Versuche.' };
    const access = await resolveStaffAccess(db, normalizedEmail);
    if (!access || access.role !== 'admin') return { success: false, error: 'Code ungültig.' };
    const ok = await consumeRecoveryCode(normalizedEmail, code);
    if (!ok) return { success: false, error: 'Recovery-Code ungültig oder bereits verwendet.' };

    const validUntil = new Date(Date.now() + 7 * 86400000);
    const [session] = await db.insert(adminSessions).values({ email: normalizedEmail, validUntil }).returning();
    const cookieStore = await cookies();
    cookieStore.set('admin_token', session.id, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: validUntil, path: '/' });
    if (trustDevice) {
      const raw = await createTrustedDevice(normalizedEmail, { userAgent: await userAgent(), ip: await clientIp() });
      cookieStore.set('admin_trusted_device', `${normalizedEmail}|${raw}`, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: new Date(Date.now() + 7 * 86400000), path: '/' });
    }
    return { success: true, destination: '/admin', remainingRecoveryCodes: await countRecoveryCodes(normalizedEmail) };
  } catch { return { success: false, error: 'Anmeldung vorübergehend nicht verfügbar.' }; }
}

export async function verifyAdminEnrollmentOtp(email: string, code: string, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { success: false, error: 'Ungültiger Code.' };
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`admin-enroll-otp:${normalizedEmail}`, 10, 15 * 60000)) return { success: false, error: 'Zu viele Versuche.' };
    const access = await resolveStaffAccess(db, normalizedEmail);
    if (!access || access.role !== 'admin') return { success: false, error: 'Code ungültig oder abgelaufen.' };

    const hash = otpHash(normalizedEmail, code);
    const [otp] = await db.select().from(adminAuth).where(and(eq(adminAuth.email, normalizedEmail), gt(adminAuth.expiresAt, new Date())));
    if (!otp || otp.attempts >= 5 || otp.otpCode.length !== hash.length || !timingSafeEqual(Buffer.from(otp.otpCode), Buffer.from(hash))) {
      if (otp) await db.update(adminAuth).set({ attempts: sql`${adminAuth.attempts} + 1` }).where(eq(adminAuth.id, otp.id));
      return { success: false, error: 'Code ungültig, abgelaufen oder bereits verwendet.' };
    }
    await db.delete(adminAuth).where(eq(adminAuth.id, otp.id));

    const { qrSecret } = await createPendingTotpSecret(normalizedEmail);
    const uri = otpauthUri(qrSecret, normalizedEmail);
    const qrDataUrl = await QRCode.toDataURL(uri);
    return { success: true, secret: qrSecret, qrDataUrl };
  } catch { return { success: false, error: 'Einrichtung vorübergehend nicht verfügbar.' }; }
}

export async function completeAdminTotpEnrollment(email: string, code: string, trustDevice: boolean, turnstileToken: string) {
  try {
    const normalizedEmail = guestDetails('Admin', email, 1).email;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { success: false, error: 'Ungültiger Code.' };
    await verifyTurnstile(turnstileToken, 'admin-login');
    if (!await takeRateLimit(`admin-enroll-complete:${normalizedEmail}`, 10, 15 * 60000)) return { success: false, error: 'Zu viele Versuche.' };
    const access = await resolveStaffAccess(db, normalizedEmail);
    if (!access || access.role !== 'admin') return { success: false, error: 'Einrichtung nicht möglich.' };

    const pending = await getPendingSecret(normalizedEmail);
    if (!pending) return { success: false, error: 'Einrichtung abgelaufen. Bitte erneut starten.' };

    const vr = verifyTotp(pending, code, null);
    if (!vr.valid) return { success: false, error: 'Code ungültig. Prüfe die App und versuche es erneut.' };

    const { recoveryCodes } = await enableTotp(normalizedEmail, pending);

    const validUntil = new Date(Date.now() + 7 * 86400000);
    const [session] = await db.insert(adminSessions).values({ email: normalizedEmail, validUntil }).returning();
    const cookieStore = await cookies();
    cookieStore.set('admin_token', session.id, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: validUntil, path: '/' });
    if (trustDevice) {
      const raw = await createTrustedDevice(normalizedEmail, { userAgent: await userAgent(), ip: await clientIp() });
      cookieStore.set('admin_trusted_device', `${normalizedEmail}|${raw}`, { httpOnly: true, secure: isProd(), sameSite: 'strict', expires: new Date(Date.now() + 7 * 86400000), path: '/' });
    }
    return { success: true, destination: '/admin', recoveryCodes };
  } catch { return { success: false, error: 'Einrichtung vorübergehend nicht verfügbar.' }; }
}

export async function resetAdminTotp(targetEmail: string) {
  try {
    await requireAdmin();
    const normalized = guestDetails('Admin', targetEmail, 1).email;
    await db.delete(adminMfa).where(eq(adminMfa.email, normalized));
    await db.delete(adminTrustedDevices).where(eq(adminTrustedDevices.email, normalized));
    return { success: true };
  } catch { return { success: false, error: '2FA konnte nicht zurückgesetzt werden.' }; }
}

export async function logout() {
  const store = await cookies();
  const token = store.get('admin_token')?.value;
  if (token && UUID_PATTERN.test(token)) await db.delete(adminSessions).where(eq(adminSessions.id, token));
  store.delete('admin_token');
  return { success: true };
}

export async function devBypassLogin() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEV_LOGIN !== 'true') return { success: false, error: 'Development login is disabled.' };
  const email = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase();
  if (!email || !isAdminEmail(email)) return { success: false, error: 'No administrator configured.' };
  const validUntil = new Date(Date.now() + 86400000);
  const [session] = await db.insert(adminSessions).values({ email, validUntil }).returning();
  (await cookies()).set('admin_token', session.id, { httpOnly: true, secure: false, sameSite: 'strict', expires: validUntil, path: '/' });
  return { success: true };
}

// (legacy requestOtp/verifyOtp removed; admin login now uses requestAdminLogin + verifyAdminTotp/verifyAdminRecoveryCode + enrollment flow)