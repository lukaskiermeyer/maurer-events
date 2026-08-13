"use server";

import { db } from "@/db";
import { galleries, events } from "@/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addGalleryImage(eventId: string, imageUrl: string) {
  await db.insert(galleries).values({
    eventId,
    imageUrl,
  });
  revalidatePath("/admin/events/[id]", "page");
  revalidatePath(`/termine/${eventId}`);
}

export async function removeGalleryImage(imageId: string) {
  await db.delete(galleries).where(eq(galleries.id, imageId));
  revalidatePath("/admin/events/[id]", "page");
}

export async function getGalleryImages(eventId: string) {
  return await db.select().from(galleries).where(eq(galleries.eventId, eventId));
}

export async function getAllGalleryImages() {
  const result = await db.select({
    gallery: galleries,
    event: events
  })
  .from(galleries)
  .leftJoin(events, eq(galleries.eventId, events.id))
  .where(isNull(events.deletedAt))
  .orderBy(galleries.createdAt);

  return result.reverse(); // Newest first
}

export async function getGalleryAlbums() {
  const result = await db.select({
    id: events.id,
    title: events.title,
    titleEn: events.titleEn,
    date: events.date,
    description: events.description,
    descriptionEn: events.descriptionEn,
    location: events.location,
    locationEn: events.locationEn,
    eventImageUrl: events.imageUrl,
    isFeaturedGallery: events.isFeaturedGallery,
    fallbackImageUrl: sql<string>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})`
  })
  .from(events)
  .leftJoin(galleries, eq(events.id, galleries.eventId))
  .where(and(eq(events.type, 'gallery'), isNull(events.deletedAt)))
  .groupBy(events.id, events.title, events.titleEn, events.date, events.description, events.descriptionEn, events.location, events.locationEn, events.imageUrl, events.isFeaturedGallery)
  .orderBy(events.date);

  return result.reverse().map(album => ({
    ...album,
    coverImage: album.eventImageUrl || album.fallbackImageUrl,
    imageCount: Number(album.imageCount)
  }));
}
