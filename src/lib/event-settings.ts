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
  const ranges = { cancellationDays: [0, 365], maxBookingsPerEmail: [1, 100], serviceFeePercent: [0, 100], serviceFeeFixedCents: [0, 999999], bookingWindowStartDays: [1, 730], bookingWindowEndHours: [0, 8760], slipFreeAfterMinutes: [0, 720] };
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
    } else if (key === 'slipNote') {
      if (typeof value !== 'string' || value.length > 500) throw new BookingError('Ungültiger Zettel-Hinweis.');
      result[key] = value.trim(); continue;
    } else if (key === 'packages') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new BookingError('Ungültige Pakete.');
      const ids = new Set<string>();
      result[key] = value.map(pkg => {
        if (!pkg || typeof pkg !== 'object' || typeof pkg.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(pkg.id) || ids.has(pkg.id) || typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.length > 150 || typeof pkg.description !== 'string' || pkg.description.length > 2000 || typeof pkg.price !== 'number' || (pkg.popular !== undefined && typeof pkg.popular !== 'boolean')) throw new BookingError('Ungültiges oder doppeltes Paket.');
        if (moneyCents(pkg.price) > 99999999) throw new BookingError('Paketpreis zu hoch.');
        const unit = pkg.unit ?? 'per_person';
        if (unit !== 'per_person' && unit !== 'per_table') throw new BookingError('Ungültige Paket-Einheit.');
        const type = pkg.type ?? 'food_package';
        if (type !== 'food_package' && type !== 'voucher_bundle' && type !== 'other') throw new BookingError('Ungültiger Pakettyp.');
        const priceIncludesVat = pkg.priceIncludesVat ?? true;
        if (typeof priceIncludesVat !== 'boolean') throw new BookingError('Ungültige MwSt.-Einstellung.');
        if (pkg.vatRate !== undefined && pkg.vatRate !== 0 && pkg.vatRate !== 7 && pkg.vatRate !== 19) throw new BookingError('Ungültiger MwSt.-Satz.');
        if (pkg.vatNote !== undefined && (typeof pkg.vatNote !== 'string' || pkg.vatNote.length > 100)) throw new BookingError('Ungültiger Steuerhinweis.');
        const active = pkg.active ?? true;
        if (typeof active !== 'boolean') throw new BookingError('Ungültiger Paketstatus.');
        let voucherCount: number | undefined;
        let voucherValueCents: number | undefined;
        let voucherTerms: string | undefined;
        if (type === 'voucher_bundle') {
          if (unit !== 'per_table') throw new BookingError('Gutscheinpakete müssen pro Tisch abgerechnet werden.');
          if (typeof pkg.voucherCount !== 'number' || !Number.isInteger(pkg.voucherCount) || pkg.voucherCount < 1 || pkg.voucherCount > 1000) throw new BookingError('Ungültige Gutscheinanzahl.');
          if (typeof pkg.voucherValueCents !== 'number' || !Number.isInteger(pkg.voucherValueCents) || pkg.voucherValueCents < 1 || pkg.voucherValueCents > 99999999) throw new BookingError('Ungültiger Gutscheinwert.');
          if (pkg.voucherTerms !== undefined && (typeof pkg.voucherTerms !== 'string' || pkg.voucherTerms.length > 2000)) throw new BookingError('Gutscheinbedingungen sind zu lang.');
          voucherCount = pkg.voucherCount;
          voucherValueCents = pkg.voucherValueCents;
          voucherTerms = pkg.voucherTerms;
        }
        ids.add(pkg.id);
        return {
          id: pkg.id,
          name: pkg.name.trim(),
          description: pkg.description,
          price: pkg.price,
          popular: pkg.popular ?? false,
          unit,
          type,
          priceIncludesVat,
          vatRate: pkg.vatRate,
          vatNote: pkg.vatNote?.trim(),
          active,
          voucherCount,
          voucherValueCents,
          voucherTerms,
        };
      }); continue;
    } else throw new BookingError(`Einstellung darf nicht geändert werden: ${key}.`);
    result[key] = value;
  }
  return result;
}
