import { and, eq, gte, inArray, lt, ne, sql, sum } from 'drizzle-orm';
import { db } from '@/db';
import { events, eventSettings, reservations, tables } from '@/db/schema';
import { BookingError, OCCUPYING_STATUSES } from './reservation-policy';

export type BookingTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Shared for bookings, exclusive for destructive layout changes. Always acquired first.
export async function lockLayout(tx: BookingTx, exclusive = false) {
  await tx.execute(exclusive ? sql`SELECT pg_advisory_xact_lock(741983201)` : sql`SELECT pg_advisory_xact_lock_shared(741983201)`);
}
export function activeReservation() {
  // Cleanup must reconcile Stripe before releasing even an expired hold.
  return inArray(reservations.status, [...OCCUPYING_STATUSES, 'pending']);
}
export function dayRange(day: Date) {
  return and(gte(reservations.reservationDate, day), lt(reservations.reservationDate, new Date(day.getTime() + 86400000)));
}
export async function lockEvent(tx: BookingTx, id: string) {
  const [event] = await tx.select().from(events).where(eq(events.id, id)).for('update');
  if (!event || event.deletedAt) throw new BookingError('Event nicht gefunden.', 404);
  return event;
}
export async function lockReservation(tx: BookingTx, id: string) {
  // Read identity, then lock the parent before the reservation on every mutation path.
  const [identity] = await tx.select({ eventId: reservations.eventId }).from(reservations).where(eq(reservations.id, id));
  if (!identity) throw new BookingError('Reservierung nicht gefunden.', 404);
  const event = await lockEvent(tx, identity.eventId);
  const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, id)).for('update');
  if (!reservation) throw new BookingError('Reservierung nicht gefunden.', 404);
  return { event, reservation };
}
export async function assertCapacity(tx: BookingTx, event: typeof events.$inferSelect, day: Date, guests: number, tableId: string | null, excludeId?: string) {
  const scope = and(dayRange(day), activeReservation(), excludeId ? ne(reservations.id, excludeId) : undefined);
  if (event.maxCapacity > 0) {
    const [agg] = await tx.select({ guests: sum(reservations.guestCount).mapWith(Number) }).from(reservations).where(and(scope, eq(reservations.eventId, event.id)));
    if ((agg.guests || 0) + guests > event.maxCapacity - event.walkInReserve) throw new BookingError('Leider sind für diesen Tag nicht mehr ausreichend Plätze verfügbar.', 409);
  }
  if (tableId) {
    const [table] = await tx.select().from(tables).where(eq(tables.id, tableId)).for('update');
    if (!table) throw new BookingError('Tisch nicht gefunden.', 404);
    // Tables are physical resources shared by all events on the same day.
    const [agg] = await tx.select({ guests: sum(reservations.guestCount).mapWith(Number) }).from(reservations).where(and(scope, eq(reservations.tableId, table.id)));
    if ((agg.guests || 0) + guests > table.capacity) throw new BookingError('Dieser Tisch hat an diesem Datum nicht mehr genügend freie Plätze.', 409);
    const [settings] = await tx.select().from(eventSettings).where(eq(eventSettings.eventId, event.id));
    const [exclusive] = await tx.select({ id: reservations.id }).from(reservations)
      .leftJoin(eventSettings, eq(eventSettings.eventId, reservations.eventId))
      .where(and(scope, eq(reservations.tableId, table.id), sql`coalesce(${eventSettings.requireFullTable}, true) = true`)).limit(1);
    // Existing active bookings retain their allocation even if full-table policy
    // changed afterwards. New placements follow the current sharing policy.
    if (((settings?.requireFullTable ?? true) || exclusive) && (agg.guests || 0) > 0) {
      const [own] = excludeId ? await tx.select({ tableId: reservations.tableId, status: reservations.status }).from(reservations).where(eq(reservations.id, excludeId)) : [];
      if (!own || own.tableId !== tableId || ![...OCCUPYING_STATUSES, 'pending'].includes(own.status as typeof OCCUPYING_STATUSES[number])) throw new BookingError('Dieser Tisch ist an diesem Datum bereits reserviert.', 409);
    }
    return table;
  }
  return null;
}
