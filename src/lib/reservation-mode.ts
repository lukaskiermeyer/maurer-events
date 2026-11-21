import type { EventRecord } from '@/types/domain';
import { localized, ui, DATE_TAG } from './localize';

export type ReservationMode = 'none' | 'email' | 'online';

type EventLike = Pick<EventRecord, 'reservable'> & { reservationMode?: string | null };

export function resolveReservationMode(event: EventLike): ReservationMode {
  if (event.reservationMode === 'none' || event.reservationMode === 'email' || event.reservationMode === 'online') {
    return event.reservationMode;
  }
  return event.reservable ? 'online' : 'none';
}

export function reservationBadge(mode: ReservationMode, locale: string): string | null {
  if (mode === 'online') return ui(locale, { de: 'Tische reservierbar', en: 'Tables reservable', bar: 'Tisch reservierbar' });
  if (mode === 'email') return ui(locale, { de: 'Reservierung per E-Mail', en: 'Reservation by email', bar: 'Reservierung per E-Mail' });
  return null;
}

export function reservationStatusLabel(mode: ReservationMode, locale: string): string {
  if (mode === 'online') return ui(locale, { de: 'Plätze verfügbar', en: 'Seats available', bar: 'Plätz verfügbar' });
  if (mode === 'email') return ui(locale, { de: 'Reservierung per E-Mail', en: 'Reservation by email', bar: 'Reservierung per E-Mail' });
  return ui(locale, { de: 'Freie Platzwahl', en: 'Open seating', bar: 'Freie Platzwahl' });
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
  const title = localized(event, 'title', locale);
  const location = localized(event, 'location', locale);
  const date = new Date(event.date).toLocaleDateString(DATE_TAG[locale] ?? 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const email = event.reservationEmail || 'servus@maurer-events.com';
  const subject = ui(locale, { de: `Reservierungsanfrage: ${title}`, en: `Reservation request: ${title}`, bar: `Reservierungsanfrog: ${title}` });
  const body = ui(locale, {
    de: `Servus Maurer Events,\n\nwir möchten gerne einen Tisch für "${title}" am ${date} in ${location} reservieren.\n\nName:\nVerein/Firma:\nAnzahl Personen:\nAnzahl Tische:\nUhrzeitwunsch:\n\nViele Grüße`,
    en: `Hello Maurer Events,\n\nwe would like to reserve a table for "${title}" on ${date} at ${location}.\n\nName:\nClub/Company:\nNumber of people:\nNumber of tables:\nPreferred time:\n\nBest regards`,
    bar: `Servus Maurer Events,\n\nmia möchten gern an Tisch für "${title}" am ${date} in ${location} reservieren.\n\nName:\nVerein/Firma:\nAnzahl Personen:\nAnzahl Tisch:\nUhrzeitwunsch:\n\nVui Grüße`,
  });
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}