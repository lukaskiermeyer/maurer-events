import { and, eq, sum } from 'drizzle-orm';
import { events, reservations } from '@/db/schema';
import { activeReservation, type BookingTx } from './reservation-db';
import { assertEventDay, BookingError, calendarDate } from './reservation-policy';

export function validateEventUpdate(data: Partial<typeof events.$inferInsert>) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BookingError('Ungültige Eventdaten.');
  const allowed = new Set(['title', 'date', 'endDate', 'location', 'description', 'imageUrl', 'link', 'reservable', 'allowTableSelection', 'maxCapacity', 'reservableDates', 'minimumConsumption', 'walkInReserve', 'publishTablesAt', 'type', 'isFeaturedGallery']);
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key)) throw new BookingError(`Eventfeld darf nicht geändert werden: ${key}.`);
    if (value === undefined) continue;
    if (['maxCapacity', 'walkInReserve', 'minimumConsumption'].includes(key) && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 99999999)) throw new BookingError('Ungültige Kapazität oder Preis.');
    if (['reservable', 'allowTableSelection', 'isFeaturedGallery'].includes(key) && typeof value !== 'boolean') throw new BookingError('Ungültige Eventeinstellung.');
    if (['date', 'endDate', 'publishTablesAt'].includes(key) && value !== null && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) throw new BookingError('Ungültiges Eventdatum.');
    if (key === 'date' && value === null) throw new BookingError('Startdatum erforderlich.');
    if (['title', 'location', 'description'].includes(key) && (typeof value !== 'string' || !value.trim() || value.length > (key === 'description' ? 100000 : 300))) throw new BookingError('Ungültiger Eventtext.');
    if (key === 'reservableDates' && value !== null) {
      if (!Array.isArray(value) || value.length > 730 || new Set(value).size !== value.length) throw new BookingError('Ungültige Buchungstage.');
      value.forEach(calendarDate);
    }
    if (key === 'type' && value !== 'event' && value !== 'gallery') throw new BookingError('Ungültiger Eventtyp.');
  }
  if (data.date && data.endDate && data.endDate < data.date) throw new BookingError('Enddatum liegt vor dem Startdatum.');
  return { ...data };
}

export async function assertEventUpdate(tx: BookingTx, event: typeof events.$inferSelect, data: Partial<typeof events.$inferInsert>) {
  const next = { ...event, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) } as typeof events.$inferSelect;
  if (next.maxCapacity > 0 && next.walkInReserve > next.maxCapacity) throw new BookingError('Walk-in-Reserve überschreitet die Kapazität.');
  if (next.endDate && next.endDate < next.date) throw new BookingError('Enddatum liegt vor dem Startdatum.');
  const occupied = await tx.select({ day: reservations.reservationDate, guests: sum(reservations.guestCount).mapWith(Number) })
    .from(reservations).where(and(eq(reservations.eventId, event.id), activeReservation())).groupBy(reservations.reservationDate);
  const days = new Map<string, number>();
  for (const row of occupied) {
    const day = calendarDate(row.day.toISOString().slice(0, 10));
    assertEventDay(next, day);
    const key = day.toISOString(); days.set(key, (days.get(key) || 0) + row.guests);
  }
  if (occupied.length && next.type !== 'event') throw new BookingError('Ein Event mit aktiven Buchungen kann nicht zur Galerie umgewandelt werden.');
  if (next.maxCapacity > 0 && [...days.values()].some(guests => guests > next.maxCapacity - next.walkInReserve)) throw new BookingError('Die neue Kapazität reicht für bestehende Buchungen nicht aus.', 409);
}
