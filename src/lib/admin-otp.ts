import { timingSafeEqual } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuth, adminSessions } from '@/db/schema';
import { otpHash } from './admin-identity';
import { resolveStaffAccess } from './staff-access';

export async function consumeAdminOtp(connection: typeof db, email: string, code: string) {
  if (!await resolveStaffAccess(connection, email)) return null;
  const hash = otpHash(email, code);
  return connection.transaction(async tx => {
    const [otp] = await tx.update(adminAuth).set({ attempts: sql`${adminAuth.attempts} + 1` }).where(and(eq(adminAuth.email, email), gt(adminAuth.expiresAt, new Date()), sql`${adminAuth.attempts} < 5`)).returning();
    if (!otp || otp.otpCode.length !== hash.length || !timingSafeEqual(Buffer.from(otp.otpCode), Buffer.from(hash))) return null;
    await tx.delete(adminAuth).where(eq(adminAuth.id, otp.id));
    const [session] = await tx.insert(adminSessions).values({ email, validUntil: new Date(Date.now() + 7 * 86400000) }).returning();
    return session;
  });
}
