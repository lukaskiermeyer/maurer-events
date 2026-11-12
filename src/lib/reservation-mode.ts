import type { EventRecord } from '@/types/domain';

export type ReservationMode = 'none' | 'email' | 'online';

type EventLike = Pick<EventRecord, 'reservable'> & { reservationMode?: string | null };

export function resolveReservationMode(event: EventLike): ReservationMode {
  if (event.reservationMode === 'none' || event.reservationMode === 'email' || event.reservationMode === 'online') {
    return event.reservationMode;
  }
  return event.reservable ? 'online' : 'none';
}

export function reservationBadge(mode: ReservationMode, locale: string): string | null {
  if (mode === 'online') return locale === 'en' ? 'Tables reservable' : 'Tische reservierbar';
  if (mode === 'email') return locale === 'en' ? 'Reservation by email' : 'Reservierung per E-Mail';
  return null;
}

export function reservationStatusLabel(mode: ReservationMode, locale: string): string {
  if (mode === 'online') return locale === 'en' ? 'Seats available' : 'Plätze verfügbar';
  if (mode === 'email') return locale === 'en' ? 'Reservation by email' : 'Reservierung per E-Mail';
  return locale === 'en' ? 'Open seating' : 'Freie Platzwahl';
}

export function reservationMailto(
  event: {
    title: string;
    date: Date | string;
    location: string;
    titleEn?: string | null;
    locationEn?: string | null;
    reservationEmail?: string | null;
  },
  locale: string,
): string {
  const title = locale === 'en' && event.titleEn ? event.titleEn : event.title;
  const location = locale === 'en' && event.locationEn ? event.locationEn : event.location;
  const date = new Date(event.date).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const email = event.reservationEmail || 'servus@maurer-events.com';
  const subject = locale === 'en' ? `Reservation request: ${title}` : `Reservierungsanfrage: ${title}`;
  const body = locale === 'en'
    ? `Hello Maurer Events,\n\nwe would like to reserve a table for "${title}" on ${date} at ${location}.\n\nName:\nClub/Company:\nNumber of people:\nNumber of tables:\nPreferred time:\n\nBest regards`
    : `Servus Maurer Events,\n\nwir möchten gerne einen Tisch für "${title}" am ${date} in ${location} reservieren.\n\nName:\nVerein/Firma:\nAnzahl Personen:\nAnzahl Tische:\nUhrzeitwunsch:\n\nViele Grüße`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}