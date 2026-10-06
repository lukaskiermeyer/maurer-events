"use server";
import { db } from '@/db';
import { events, eventSettings } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { ensureEventSettings, validateEventSettings } from '@/lib/event-settings';
import { lockLayout, lockEvent } from '@/lib/reservation-db';
import { uuid } from '@/lib/reservation-policy';
import { revalidatePath } from 'next/cache';

export async function getPublicEventSettings(eventId: string) {
  uuid(eventId);
  const [row] = await db.select({ requireFullTable: eventSettings.requireFullTable, minConsumptionCents: eventSettings.minConsumptionCents,
    timeSlots: eventSettings.timeSlots, packages: eventSettings.packages, cancellationDays: eventSettings.cancellationDays,
    maxBookingsPerEmail: eventSettings.maxBookingsPerEmail, customServiceFee: eventSettings.customServiceFee,
    serviceFeePercent: eventSettings.serviceFeePercent, serviceFeeFixedCents: eventSettings.serviceFeeFixedCents,
    bookingWindowStartDays: eventSettings.bookingWindowStartDays, bookingWindowEndHours: eventSettings.bookingWindowEndHours,
  }).from(eventSettings).innerJoin(events, eq(events.id, eventSettings.eventId)).where(and(eq(events.id, eventId), isNull(events.deletedAt)));
  return row || null;
}
export async function getEventSettings(eventId: string) { await requireAdmin(); return ensureEventSettings(eventId); }
export async function createDefaultEventSettings(eventId: string) { await requireAdmin(); return ensureEventSettings(eventId); }
export async function updateEventSettings(eventId: string, settings: Partial<typeof eventSettings.$inferInsert>) {
  await requireAdmin(); uuid(eventId);
  const safe = validateEventSettings(settings);
  const updated = await db.transaction(async tx => {
    await lockLayout(tx); await lockEvent(tx, eventId);
    const [row] = await tx.insert(eventSettings).values({ eventId, ...safe }).onConflictDoUpdate({ target: eventSettings.eventId, set: { ...safe, updatedAt: new Date() } }).returning();
    return row;
  });
  revalidatePath('/[locale]', 'layout');
  return updated;
}
