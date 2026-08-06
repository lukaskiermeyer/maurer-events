"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_noStore as noStore, unstable_cache } from "next/cache";
import { translateContent } from "@/lib/translate";

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
}) {
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
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
  revalidateTag("events", "max");
}



export const getEvents = unstable_cache(
  async () => {
    return await db.select().from(events).orderBy(asc(events.date));
  },
  ['public-events-list'],
  { tags: ['events'] }
);

export async function getAdminStats() {
  noStore();
  const { reservations, tables } = await import("@/db/schema");
  const allEvents = await db.select().from(events);
  
  const allRes = await db.select({
    reservation: reservations,
    isVip: tables.isVip,
    vipPrice: tables.vipPrice
  })
  .from(reservations)
  .leftJoin(tables, eq(reservations.tableId, tables.id));
  
  let totalRevenue = 0;
  let devShare = 0;

  for (const r of allRes) {
    if (r.reservation.status === "paid" || r.reservation.status === "confirmed") {
      totalRevenue += r.reservation.amountTotal;
      if (r.isVip && r.vipPrice) {
        // Developer gets 20% of the VIP Aufpreis
        devShare += (r.vipPrice * 0.20);
      }
    }
  }
    
  return {
    totalEvents: allEvents.length,
    reservableEvents: allEvents.filter(e => e.reservable).length,
    totalReservations: allRes.length,
    revenue: totalRevenue / 100,
    devShare: devShare / 100
  };
}
