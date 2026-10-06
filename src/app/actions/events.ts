"use server";

import { db } from "@/db";
import { events, eventSettings } from "@/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_noStore as noStore, unstable_cache } from "next/cache";
import { translateContent } from "@/lib/translate";
import { requireAdmin } from "@/lib/auth";
import { assertEventUpdate, validateEventUpdate } from '@/lib/event-policy';
import { lockEvent, lockLayout } from '@/lib/reservation-db';
import { moneyCents, uuid } from '@/lib/reservation-policy';

export async function createEvent(data: {
  title: string;
  date: Date;
  endDate?: Date;
  reservableDates?: any;
  location: string;
  description: string;
  imageUrl?: string;
  link: string;
  reservable: boolean;
  allowTableSelection?: boolean;
  maxCapacity?: number;
  minimumConsumption?: number;
  walkInReserve?: number;
  publishTablesAt?: Date;
  type?: string;
}) {
  await requireAdmin();
  validateEventUpdate({ ...data, type: data.type as 'event' | 'gallery', minimumConsumption: data.minimumConsumption === undefined ? 5000 : moneyCents(data.minimumConsumption) });
  if (data.maxCapacity > 0 && data.walkInReserve > data.maxCapacity) throw new Error('Walk-in-Reserve überschreitet die Kapazität.');
  const [titleEn, locationEn, descriptionEn] = await Promise.all([
    translateContent(data.title),
    translateContent(data.location),
    translateContent(data.description)
  ]);

  await db.transaction(async tx => {
  const [newEvent] = await tx.insert(events).values({
    title: data.title,
    date: data.date,
    endDate: data.endDate,
    location: data.location,
    description: data.description,
    imageUrl: data.imageUrl,
    link: data.link,
    reservable: data.reservable,
    allowTableSelection: data.allowTableSelection ?? true,
    maxCapacity: data.maxCapacity || 0,
    reservableDates: data.reservableDates,
    minimumConsumption: data.minimumConsumption === undefined ? 5000 : moneyCents(data.minimumConsumption),
    walkInReserve: data.walkInReserve || 0,
    publishTablesAt: data.publishTablesAt,
    type: data.type || 'event',
    titleEn,
    locationEn,
    descriptionEn
  }).returning({ id: events.id });

  await tx.insert(eventSettings).values({ eventId: newEvent.id });
  });

  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidateTag("events", "max");
}

export async function updateEvent(id: string, data: Partial<typeof events.$inferInsert>) {
  await requireAdmin(); uuid(id); validateEventUpdate(data);
  const updates: Partial<typeof events.$inferInsert> = { ...data, updatedAt: new Date() };

  // If any of the translatable fields changed, re-translate them
  if (data.title !== undefined || data.location !== undefined || data.description !== undefined) {
    const [titleEn, locationEn, descriptionEn] = await Promise.all([
      data.title !== undefined ? translateContent(data.title) : undefined,
      data.location !== undefined ? translateContent(data.location) : undefined,
      data.description !== undefined ? translateContent(data.description) : undefined,
    ]);

    if (titleEn !== undefined) updates.titleEn = titleEn;
    if (locationEn !== undefined) updates.locationEn = locationEn;
    if (descriptionEn !== undefined) updates.descriptionEn = descriptionEn;
  }

  await db.transaction(async tx => {
    await lockLayout(tx);
    const event = await lockEvent(tx, id);
    await assertEventUpdate(tx, event, data);
    await tx.update(events).set(updates).where(eq(events.id, id));
  });
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidateTag("events", "max");
}

export async function deleteEvent(id: string) {
  await requireAdmin();

  const { inArray, eq } = await import("drizzle-orm");
  const { reservations } = await import("@/db/schema");

  await db.transaction(async (tx) => {
    await lockLayout(tx); await lockEvent(tx, uuid(id));
    const { galleries, waitlists } = await import("@/db/schema");

    // Blockade: Prüfe, ob es Reservierungen, Galerien oder Wartelisten-Einträge gibt
    const [resCount, galCount, waitCount] = await Promise.all([
      tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.eventId, id)).limit(1),
      tx.select({ id: galleries.id }).from(galleries).where(eq(galleries.eventId, id)).limit(1),
      tx.select({ id: waitlists.id }).from(waitlists).where(eq(waitlists.eventId, id)).limit(1)
    ]);

    if (resCount.length > 0 || galCount.length > 0 || waitCount.length > 0) {
      throw new Error("Event kann nicht gelöscht werden, da noch Reservierungen, Galerien oder Wartelisten-Einträge verknüpft sind.");
    }

    await tx.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
  });

  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidatePath("/admin");
  revalidateTag("events", "max");
}



export const getEvents = unstable_cache(
  async () => {
    return await db.select().from(events).where(and(eq(events.type, 'event'), isNull(events.deletedAt))).orderBy(asc(events.date));
  },
  ['public-events-list'],
  { tags: ['events'] }
);

export const getEventById = unstable_cache(
  async (id: string) => {
    const result = await db.select().from(events).where(and(eq(events.id, id), isNull(events.deletedAt)));
    return result[0] || null;
  },
  ['public-event-by-id'],
  { tags: ['events'] }
);

export async function getAllEvents() {
  return await db.select().from(events).where(isNull(events.deletedAt)).orderBy(asc(events.date));
}
export async function getAdminStats() {
  await requireAdmin();
  noStore();
  const { sql, sum, count, desc } = await import("drizzle-orm");
  const { reservations, tables, waitlists } = await import("@/db/schema");
  const allEvents = await db.select().from(events).where(isNull(events.deletedAt)).orderBy(asc(events.date));

  const waitlistAgg = await db.select({ count: count() }).from(waitlists);
  const waitlistCount = waitlistAgg[0].count;

  const statsAgg = await db.select({
    totalRevenue: sum(
      sql`CASE WHEN ${reservations.status} IN ('paid', 'confirmed') THEN ${reservations.amountTotal} ELSE 0 END`
    ).mapWith(Number),
    devShare: sum(
      sql`CASE WHEN ${reservations.status} IN ('paid', 'confirmed') AND ${tables.isVip} = true THEN ${tables.vipPrice} * 0.20 ELSE 0 END`
    ).mapWith(Number),
    unassignedPaidCount: sum(
      sql`CASE WHEN ${reservations.status} IN ('paid', 'confirmed') AND ${reservations.tableId} IS NULL THEN 1 ELSE 0 END`
    ).mapWith(Number),
    pendingCount: sum(
      sql`CASE WHEN ${reservations.status} = 'pending' THEN 1 ELSE 0 END`
    ).mapWith(Number),
    totalReservations: count()
  })
  .from(reservations)
  .leftJoin(tables, eq(reservations.tableId, tables.id));

  const totalRevenue = statsAgg[0]?.totalRevenue || 0;
  const devShare = statsAgg[0]?.devShare || 0;
  const unassignedPaidCount = statsAgg[0]?.unassignedPaidCount || 0;
  const pendingCount = statsAgg[0]?.pendingCount || 0;
  const totalReservations = statsAgg[0]?.totalReservations || 0;

  const futureEvents = allEvents.filter(e => e.type === 'event' && e.date >= new Date());
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;

  let nextEventStats = null;
  if (nextEvent) {
    const nextEventAgg = await db.select({
      guestsAssigned: sum(reservations.guestCount).mapWith(Number)
    })
    .from(reservations)
    .where(and(eq(reservations.eventId, nextEvent.id), sql`${reservations.status} != 'cancelled'`));

    nextEventStats = {
      title: nextEvent.title,
      date: nextEvent.date,
      guests: nextEventAgg[0]?.guestsAssigned || 0,
      capacity: nextEvent.maxCapacity || "Unlimitiert"
    };
  }

  // Get 5 most recent reservations
  const recentReservations = await db.select({
    id: reservations.id,
    guestName: reservations.guestName,
    status: reservations.status,
    createdAt: reservations.createdAt,
    amountTotal: reservations.amountTotal
  })
  .from(reservations)
  .orderBy(desc(reservations.createdAt))
  .limit(5);

  return {
    totalEvents: allEvents.length,
    reservableEvents: allEvents.filter(e => e.reservable).length,
    totalReservations,
    waitlistCount,
    revenue: totalRevenue / 100,
    devShare: devShare / 100,
    pendingCount,
    unassignedPaidCount,
    nextEventStats,
    recentReservations
  };
}

export async function convertEventToGallery(id: string) {
  await requireAdmin();
  await db.update(events).set({ type: 'gallery' }).where(eq(events.id, id));
  revalidatePath("/admin");
}

export async function toggleFeaturedGallery(id: string, isFeatured: boolean) {
  await requireAdmin();
  await db.update(events).set({ isFeaturedGallery: isFeatured }).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
  revalidateTag("events", "max");
}
