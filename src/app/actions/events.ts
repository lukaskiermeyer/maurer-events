"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { translateContent } from "@/lib/translate";

export async function createEvent(data: {
  title: string;
  date: Date;
  location: string;
  description: string;
  imageUrl?: string;
  link: string;
  reservable: boolean;
  minimumConsumption?: number;
}) {
  const [titleEn, locationEn, descriptionEn] = await Promise.all([
    translateContent(data.title),
    translateContent(data.location),
    translateContent(data.description)
  ]);

  await db.insert(events).values({
    title: data.title,
    date: data.date,
    location: data.location,
    description: data.description,
    imageUrl: data.imageUrl,
    link: data.link,
    reservable: data.reservable,
    minimumConsumption: data.minimumConsumption ? data.minimumConsumption * 100 : 5000,
    titleEn,
    locationEn,
    descriptionEn
  });
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
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
}

export async function deleteEvent(id: string) {
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
}

export async function getEvents() {
  return await db.select().from(events).orderBy(asc(events.date));
}
