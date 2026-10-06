import { calculateFeeFromCents } from './pricing';

export class BookingError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(value: unknown, label = 'ID'): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new BookingError(`Ungültige ${label}.`);
  return value.toLowerCase();
}
export function guestDetails(name: unknown, email: unknown, count: unknown) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || /[\x00-\x1f\x7f]/.test(name)) throw new BookingError('Ungültiger Name.');
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new BookingError('Ungültige E-Mail-Adresse.');
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100) throw new BookingError('Ungültige Gästezahl.');
  return { guestName: name.trim(), email: email.trim().toLowerCase(), guestCount: count };
}
export function calendarDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BookingError('Ungültiges Datum.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BookingError('Ungültiges Datum.');
  return date;
}
export function cleanTime(value: unknown): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?: Uhr)?$/.test(value)) throw new BookingError('Ungültige Uhrzeit.');
  return value.slice(0, 5);
}

export const DEFAULT_PACKAGES = [
  { id: 'brotzeit', name: 'Brotzeit-Paket', price: 25, description: '1 Maß & 1 halbes Hendl', popular: false },
  { id: 'vollgas', name: 'Vollgas-Paket', price: 50, description: '2 Maß, 1 Hauptgericht & 1 Schnaps', popular: true },
];
export const DEFAULT_TIMES = ['17:00', '18:00', '19:00'];

// A calendar day is stored at UTC midnight; admission times are German local time.
// Reject ambiguous/nonexistent DST times instead of silently choosing another time.
export function bookingInstant(day: string, time: string): Date {
  calendarDate(day); cleanTime(time);
  const target = `${day}T${time}`;
  const wall = new Date(`${target}:00Z`).getTime();
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const candidates = [1, 2].map(offset => new Date(wall - offset * 3600000))
    .filter(date => formatter.format(date).replace(' ', 'T') === target);
  if (candidates.length !== 1) throw new BookingError('Diese Uhrzeit ist wegen der Zeitumstellung nicht eindeutig buchbar.');
  return candidates[0];
}

export function assertEventDay(event: { date: Date; reservableDates?: unknown; deletedAt: Date | null }, day: Date) {
  if (event.deletedAt) throw new BookingError('Event nicht gefunden.', 404);
  const allowed = Array.isArray(event.reservableDates) && event.reservableDates.length
    ? event.reservableDates : [new Date(event.date).toISOString().slice(0, 10)];
  if (!allowed.includes(day.toISOString().slice(0, 10))) throw new BookingError('Datum nicht buchbar.');
}

export function assertBookingWindow(instant: Date, startDays = 90, endHours = 2, now = new Date()) {
  const distance = instant.getTime() - now.getTime();
  if (distance > startDays * 86400000) throw new BookingError(`Buchungen sind erst ab ${startDays} Tagen vor dem Event möglich.`);
  if (distance < endHours * 3600000) throw new BookingError('Online-Buchungen sind für dieses Datum geschlossen.');
}

export function moneyCents(value: number): number {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - cents) > 0.000001 || !Number.isSafeInteger(cents)) throw new BookingError('Ungültiger Preis.');
  return cents;
}
export function bookingPrice(packagePrice: number, guests: number, vipCents = 0, percent?: number, fixed?: number) {
  const unitAmount = moneyCents(packagePrice);
  const subtotal = unitAmount * guests + vipCents;
  const fee = calculateFeeFromCents(subtotal, percent, fixed);
  const total = subtotal + fee;
  if (![unitAmount, subtotal, fee, total, vipCents].every(n => Number.isSafeInteger(n) && n >= 0) || total < 50 || total > 99999999) throw new BookingError('Ungültiger Buchungsbetrag.');
  return { unitAmount, subtotal, fee, total };
}

export const OCCUPYING_STATUSES = ['paid', 'confirmed', 'checked_in', 'payment_pending'] as const;
export const ADMIN_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['paid', 'cancelled'], payment_pending: ['cancelled'], paid: ['confirmed', 'cancelled', 'checked_in'],
  confirmed: ['cancelled', 'checked_in'], checked_in: [], cancelled: [], expired: [], refunded: [], disputed: [],
  payment_review: ['paid', 'cancelled'],
};
