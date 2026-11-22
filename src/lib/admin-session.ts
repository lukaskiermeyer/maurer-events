import { db } from '@/db';
import { adminPasskeySessions, adminUsers } from '@/db/schema';
import { eq, and, gt, isNull, lt, or } from 'drizzle-orm';
import { randomToken, hashToken, ipHash as ipHashFn } from './admin-crypto';

// Login ist jetzt Passwort + TOTP: längere Sessions als beim Passkey-Tap.
const IDLE_HOURS = Number(process.env.SESSION_IDLE_HOURS || 24);
const ABS_DAYS = Number(process.env.SESSION_ABSOLUTE_DAYS || 30);
const STEP_UP_TTL = Number(process.env.STEP_UP_TTL_SECONDS || 300);

export interface AdminSessionInfo {
  token: string;
  adminId: string;
  email: string;
  stepUpAt: Date | null;
}

export async function createAdminSession(params: {
  adminId: string;
  userAgent?: string | null;
  ip?: string | null;
  deviceLabel?: string | null;
}): Promise<{ token: string; idleExpiresAt: Date; absoluteExpiresAt: Date }> {
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const now = new Date();
  const idleExpiresAt = new Date(now.getTime() + IDLE_HOURS * 3600 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + ABS_DAYS * 86400 * 1000);
  await db.insert(adminPasskeySessions).values({
    tokenHash,
    adminId: params.adminId,
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
    userAgent: params.userAgent ?? null,
    ipHash: params.ip ? ipHashFn(params.ip) : null,
    deviceLabel: params.deviceLabel ?? null,
  });
  return { token, idleExpiresAt, absoluteExpiresAt };
}

export async function getAdminSession(token: string | undefined): Promise<{
  tokenHash: string;
  adminId: string;
  email: string;
  admin: typeof adminUsers.$inferSelect;
  session: typeof adminPasskeySessions.$inferSelect;
  stepUpValid: boolean;
} | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db.select().from(adminPasskeySessions)
    .where(eq(adminPasskeySessions.tokenHash, tokenHash));
  const session = rows[0];
  if (!session) return null;
  if (session.revokedAt) return null;
  const now = new Date();
  if (session.idleExpiresAt <= now) return null;
  if (session.absoluteExpiresAt <= now) return null;

  // sliding idle refresh (throttled: max 1/min)
  const lastSeen = session.lastSeenAt.getTime();
  if (now.getTime() - lastSeen > 60_000) {
    const newIdle = new Date(now.getTime() + IDLE_HOURS * 3600 * 1000);
    // cap at absolute
    const capped = newIdle > session.absoluteExpiresAt ? session.absoluteExpiresAt : newIdle;
    await db.update(adminPasskeySessions)
      .set({ lastSeenAt: now, idleExpiresAt: capped })
      .where(eq(adminPasskeySessions.tokenHash, tokenHash));
    session.lastSeenAt = now;
    session.idleExpiresAt = capped;
  }

  const admins = await db.select().from(adminUsers).where(eq(adminUsers.id, session.adminId));
  const admin = admins[0];
  if (!admin || admin.status !== 'active') return null;
  if (admin.lockedUntil && admin.lockedUntil > now) return null;

  const stepUpValid = !!session.stepUpAt && (now.getTime() - session.stepUpAt.getTime() <= STEP_UP_TTL * 1000);
  return { tokenHash, adminId: session.adminId, email: admin.email, admin, session, stepUpValid };
}

export async function revokeAdminSession(token: string, reason?: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.update(adminPasskeySessions)
    .set({ revokedAt: new Date(), revokeReason: reason ?? 'logout' })
    .where(eq(adminPasskeySessions.tokenHash, tokenHash));
}

export async function revokeAllAdminSessions(adminId: string, reason?: string): Promise<void> {
  await db.update(adminPasskeySessions)
    .set({ revokedAt: new Date(), revokeReason: reason ?? 'revoke_all' })
    .where(and(eq(adminPasskeySessions.adminId, adminId), isNull(adminPasskeySessions.revokedAt)));
}

export async function setStepUp(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.update(adminPasskeySessions)
    .set({ stepUpAt: new Date() })
    .where(eq(adminPasskeySessions.tokenHash, tokenHash));
}

export async function listAdminSessions(adminId: string) {
  return db.select().from(adminPasskeySessions)
    .where(and(eq(adminPasskeySessions.adminId, adminId), isNull(adminPasskeySessions.revokedAt)));
}

export function stepUpTtlSeconds(): number {
  return STEP_UP_TTL;
}
