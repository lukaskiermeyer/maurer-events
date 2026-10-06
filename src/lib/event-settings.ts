import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { eventSettings } from '@/db/schema';
import { BookingError, cleanTime, moneyCents, uuid } from './reservation-policy';

export async function ensureEventSettings(eventId: string) {
  uuid(eventId);
  await db.insert(eventSettings).values({ eventId }).onConflictDoNothing({ target: eventSettings.eventId });
  const [settings] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, eventId));
  return settings;
}

export function validateEventSettings(input: unknown): Partial<typeof eventSettings.$inferInsert> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError('Ungültige Einstellungen.');
  const result: Record<string, unknown> = {};
  const ranges = { minConsumptionCents: [0, 99999999], cancellationDays: [0, 365], maxBookingsPerEmail: [1, 100], serviceFeePercent: [0, 100], serviceFeeFixedCents: [0, 999999], bookingWindowStartDays: [1, 730], bookingWindowEndHours: [0, 8760] };
  const booleans = ['requireFullTable', 'customServiceFee', 'autoSendTicket'];
  for (const [key, value] of Object.entries(input)) {
    if (booleans.includes(key)) {
      if (typeof value !== 'boolean') throw new BookingError(`Ungültige Einstellung: ${key}.`);
    } else if (Object.hasOwn(ranges, key)) {
      const [min, max] = ranges[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (key !== 'serviceFeePercent' && !Number.isInteger(value))) throw new BookingError(`Ungültige Einstellung: ${key}.`);
    } else if (key === 'timeSlots') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 48) throw new BookingError('Ungültige Zeitslots.');
      const slots = value.map(cleanTime);
      if (new Set(slots).size !== slots.length) throw new BookingError('Doppelte Zeitslots.');
      result[key] = slots; continue;
    } else if (key === 'packages') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new BookingError('Ungültige Pakete.');
      const ids = new Set<string>();
      result[key] = value.map(pkg => {
        if (!pkg || typeof pkg !== 'object' || typeof pkg.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(pkg.id) || ids.has(pkg.id) || typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.length > 150 || typeof pkg.description !== 'string' || pkg.description.length > 2000 || typeof pkg.price !== 'number' || (pkg.popular !== undefined && typeof pkg.popular !== 'boolean')) throw new BookingError('Ungültiges oder doppeltes Paket.');
        if (moneyCents(pkg.price) > 99999999) throw new BookingError('Paketpreis zu hoch.');
        ids.add(pkg.id);
        return { id: pkg.id, name: pkg.name.trim(), description: pkg.description, price: pkg.price, popular: pkg.popular ?? false };
      }); continue;
    } else throw new BookingError(`Einstellung darf nicht geändert werden: ${key}.`);
    result[key] = value;
  }
  return result;
}
