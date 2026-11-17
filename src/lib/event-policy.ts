import { and, eq, sum } from 'drizzle-orm';
import { events, reservations } from '@/db/schema';
import { activeReservation, type BookingTx } from './reservation-db';
import { assertEventDay, BookingError, calendarDate } from './reservation-policy';

export function validateEventUpdate(data: Partial<typeof events.$inferInsert>) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BookingError('Ungültige Eventdaten.');
  const allowed = new Set(['title', 'date', 'endDate', 'location', 'zip', 'description', 'imageUrl', 'link', 'mapUrl', 'reservable', 'allowTableSelection', 'reservationMode', 'reservationEmail', 'reservationNote', 'reservationDeadline', 'expectedGuests', 'maxCapacity', 'reservableDates', 'minimumConsumption', 'walkInReserve', 'publishTablesAt', 'type', 'isFeaturedGallery', 'isPublished']);
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key)) throw new BookingError(`Eventfeld darf nicht geändert werden: ${key}.`);
    if (value === undefined) continue;
    if (['maxCapacity', 'walkInReserve', 'minimumConsumption', 'expectedGuests'].includes(key) && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 99999999)) throw new BookingError('Ungültige Kapazität oder Preis.');
    if (['reservable', 'allowTableSelection', 'isFeaturedGallery', 'isPublished'].includes(key) && typeof value !== 'boolean') throw new BookingError('Ungültige Eventeinstellung.');
    if (['date', 'endDate', 'publishTablesAt', 'reservationDeadline'].includes(key) && value !== null && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) throw new BookingError('Ungültiges Eventdatum.');
    if (key === 'date' && value === null) throw new BookingError('Startdatum erforderlich.');
    if (['title', 'location', 'description'].includes(key) && (typeof value !== 'string' || !value.trim() || value.length > (key === 'description' ? 100000 : 300))) throw new BookingError('Ungültiger Eventtext.');
if (key === 'mapUrl' && value !== null && (typeof value !== 'string' || value.length > 2048)) throw new BookingError('Ungültige Karten-URL.');
if (key === 'zip' && value !== null && (typeof value !== 'string' || value.length > 20)) throw new BookingError('Ungültige PLZ.');
    if (key === 'reservationMode' && value !== 'none' && value !== 'email' && value !== 'online') throw new BookingError('Ungültiger Reservierungsmodus.');
    if (key === 'reservationEmail' && (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))) throw new BookingError('Ungültige Reservierungs-E-Mail.');
    if (key === 'reservationNote' && value !== null && (typeof value !== 'string' || value.length > 2000)) throw new BookingError('Reservierungshinweis ist zu lang.');
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
  if (data.reservationMode === 'online' && event.reservationMode !== 'online' && !event.reservable) throw new BookingError('Online-Reservierung ist derzeit deaktiviert.', 409);
  const next = { ...event, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) } as typeof events.$inferSelect;
  if (next.maxCapacity > 0 && next.walkInReserve > next.maxCapacity) throw new BookingError('Walk-in-Reserve überschreitet die Kapazität.');
  if (next.endDate && next.endDate < next.date) throw new BookingError('Enddatum liegt vor dem Startdatum.');
  const occupied = await tx.select({ day: reservations.reservationDate, guests: sum(reservations.guestCount).mapWith(Number) })
    .from(reservations).where(and(eq(reservations.eventId, event.id), activeReservation())).groupBy(reservations.reservationDate);
  const days = new Map<string, number>();
  const bookingDisabled = next.reservationMode === 'none';
  for (const row of occupied) {
    const day = calendarDate(row.day.toISOString().slice(0, 10));
    if (!bookingDisabled) assertEventDay(next, day);
    const key = day.toISOString(); days.set(key, (days.get(key) || 0) + row.guests);
  }
  if (occupied.length && next.type !== 'event') throw new BookingError('Ein Event mit aktiven Buchungen kann nicht zur Galerie umgewandelt werden.');
  if (next.maxCapacity > 0 && [...days.values()].some(guests => guests > next.maxCapacity - next.walkInReserve)) throw new BookingError('Die neue Kapazität reicht für bestehende Buchungen nicht aus.', 409);
}
