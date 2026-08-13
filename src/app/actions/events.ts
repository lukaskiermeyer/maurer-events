"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_noStore as noStore, unstable_cache } from "next/cache";
import { translateContent } from "@/lib/translate";
import { requireAdmin } from "@/lib/auth";

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
  const [titleEn, locationEn, descriptionEn] = await Promise.all([
    translateContent(data.title),
    translateContent(data.location),
    translateContent(data.description)
  ]);

  await db.insert(events).values({
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
    minimumConsumption: data.minimumConsumption ? data.minimumConsumption * 100 : 5000,
    walkInReserve: data.walkInReserve || 0,
    publishTablesAt: data.publishTablesAt,
    type: data.type || 'event',
    titleEn,
    locationEn,
    descriptionEn
  });
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidateTag("events", "max");
}

export async function updateEvent(id: string, data: Partial<typeof events.$inferInsert>) {
  await requireAdmin();
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

  await db.update(events).set(updates).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidateTag("events", "max");
}

export async function deleteEvent(id: string) {
  await requireAdmin();
  await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
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

export async function getAllEvents() {
  return await db.select().from(events).where(isNull(events.deletedAt)).orderBy(asc(events.date));
}
export async function getAdminStats() {
  await requireAdmin();
  noStore();
  const { reservations, tables, waitlists } = await import("@/db/schema");
  const allEvents = await db.select().from(events).where(isNull(events.deletedAt)).orderBy(asc(events.date));
  
  const allRes = await db.select({
    reservation: reservations,
    isVip: tables.isVip,
    vipPrice: tables.vipPrice
  })
  .from(reservations)
  .leftJoin(tables, eq(reservations.tableId, tables.id))
  .orderBy(reservations.createdAt); // We'll sort in memory for recent
  
  const allWaitlist = await db.select().from(waitlists);
  
  let totalRevenue = 0;
  let devShare = 0;
  let pendingCount = 0;
  let unassignedPaidCount = 0;

  for (const r of allRes) {
    if (r.reservation.status === "paid" || r.reservation.status === "confirmed") {
      totalRevenue += r.reservation.amountTotal;
      if (r.isVip && r.vipPrice) {
        devShare += (r.vipPrice * 0.20);
      }
      if (!r.reservation.tableId) {
        unassignedPaidCount++;
      }
    } else if (r.reservation.status === "pending") {
      pendingCount++;
    }
  }
  
  const futureEvents = allEvents.filter(e => e.type === 'event' && e.date >= new Date());
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
  
  let nextEventStats = null;
  if (nextEvent) {
    const nextEventRes = allRes.filter(r => r.reservation.eventId === nextEvent.id && r.reservation.status !== 'cancelled');
    const guestsAssigned = nextEventRes.reduce((sum, r) => sum + r.reservation.guestCount, 0);
    nextEventStats = {
      title: nextEvent.title,
      date: nextEvent.date,
      guests: guestsAssigned,
      capacity: nextEvent.maxCapacity || "Unlimitiert"
    };
  }

  // Get 5 most recent reservations
  const recentReservations = [...allRes]
    .sort((a, b) => new Date(b.reservation.createdAt).getTime() - new Date(a.reservation.createdAt).getTime())
    .slice(0, 5)
    .map(r => ({
      id: r.reservation.id,
      guestName: r.reservation.guestName,
      status: r.reservation.status,
      createdAt: r.reservation.createdAt,
      amountTotal: r.reservation.amountTotal
    }));
    
  return {
    totalEvents: allEvents.length,
    reservableEvents: allEvents.filter(e => e.reservable).length,
    totalReservations: allRes.length,
    waitlistCount: allWaitlist.length,
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
