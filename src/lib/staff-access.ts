import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { adminSessions, events, scannerAccess } from '@/db/schema';
import { isAdminEmail } from './admin-identity';
import { BookingError, guestDetails, UUID_PATTERN, uuid } from './reservation-policy';
import { reservationAdmin } from './reservation-admin';

export type StaffAccess = { email: string; role: 'admin' | 'scanner'; eventIds: string[] };

export async function resolveStaffAccess(connection: typeof db, email: string): Promise<StaffAccess | null> {
  const normalized = email.trim().toLowerCase();
  if (isAdminEmail(normalized)) return { email: normalized, role: 'admin', eventIds: [] };
  const grants = await connection.select({ eventId: scannerAccess.eventId }).from(scannerAccess)
    .innerJoin(events, eq(events.id, scannerAccess.eventId))
    .where(and(eq(scannerAccess.email, normalized), gt(scannerAccess.validUntil, new Date()), isNull(events.deletedAt)));
  return grants.length ? { email: normalized, role: 'scanner', eventIds: grants.map(grant => grant.eventId) } : null;
}

export async function staffSession(connection: typeof db, token: string | undefined): Promise<StaffAccess | null> {
  if (!token || !UUID_PATTERN.test(token)) return null;
  const [session] = await connection.select({ email: adminSessions.email }).from(adminSessions)
    .where(and(eq(adminSessions.id, token), gt(adminSessions.validUntil, new Date())));
  return session ? resolveStaffAccess(connection, session.email) : null;
}

export function assertStaffPermission(staff: StaffAccess | null, permission: 'admin' | 'scan', eventId?: string) {
  if (!staff || (permission === 'admin' && staff.role !== 'admin') ||
    (permission === 'scan' && staff.role === 'scanner' && eventId && !staff.eventIds.includes(eventId))) {
    throw new BookingError('Für diesen Bereich hast du keine Berechtigung.', 403);
  }
}

export async function grantScannerAccess(connection: typeof db, actor: StaffAccess, input: { eventId: string; email: string; validUntil: string }) {
  assertStaffPermission(actor, 'admin');
  const eventId = uuid(input.eventId);
  const email = guestDetails('Einlass', input.email, 1).email;
  const validUntil = new Date(input.validUntil);
  if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date() || validUntil.getTime() > Date.now() + 90 * 86400000) {
    throw new BookingError('Bitte ein Ablaufdatum innerhalb der nächsten 90 Tage wählen.');
  }
  if (isAdminEmail(email)) throw new BookingError('Diese E-Mail hat bereits vollen Admin-Zugriff.');
  const [event] = await connection.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt)));
  if (!event) throw new BookingError('Veranstaltung nicht gefunden.');
  const [existing] = await connection.select({ id: scannerAccess.id }).from(scannerAccess)
    .where(and(eq(scannerAccess.eventId, eventId), eq(scannerAccess.email, email)));
  if (existing) {
    await connection.update(scannerAccess).set({ validUntil, createdBy: actor.email }).where(eq(scannerAccess.id, existing.id));
  } else {
    await connection.insert(scannerAccess).values({ eventId, email, validUntil, createdBy: actor.email }).onConflictDoNothing();
  }
}

export async function revokeScannerAccess(connection: typeof db, actor: StaffAccess, eventId: string, accessId: string) {
  assertStaffPermission(actor, 'admin');
  await connection.delete(scannerAccess).where(and(eq(scannerAccess.id, uuid(accessId)), eq(scannerAccess.eventId, uuid(eventId))));
}

export async function scanForStaff(connection: typeof db, staff: StaffAccess, code: string, eventId?: string) {
  assertStaffPermission(staff, 'scan', eventId);
  if (eventId) uuid(eventId);
  if (staff.role === 'admin') return reservationAdmin(connection).scan(code, eventId);
  return connection.transaction(async tx => {
    // Lock live grants until check-in commits, so revocation also covers old sessions.
    const grants = await tx.select({ eventId: scannerAccess.eventId }).from(scannerAccess)
      .innerJoin(events, eq(events.id, scannerAccess.eventId))
      .where(and(eq(scannerAccess.email, staff.email), gt(scannerAccess.validUntil, new Date()), isNull(events.deletedAt),
        eventId ? eq(scannerAccess.eventId, eventId) : undefined)).for('share');
    if (!grants.length) throw new BookingError('Dein Scanner-Zugang ist abgelaufen oder wurde widerrufen.', 403);
    return reservationAdmin(tx as unknown as typeof db).scan(code, eventId, grants.map(grant => grant.eventId));
  });
}
