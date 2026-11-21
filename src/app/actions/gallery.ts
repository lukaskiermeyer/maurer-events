"use server";

import { db } from "@/db";
import { galleries, events } from "@/db/schema";
import { eq, sql, and, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function addGalleryImage(eventId: string | null, imageUrl: string) {
  await requireAdmin();
  await db.insert(galleries).values({
    eventId: eventId || null,
    imageUrl,
  });
  if (eventId) {
    revalidatePath("/admin/events/[id]", "page");
    revalidatePath(`/termine/${eventId}`);
  }
  revalidatePath("/admin", "page");
  revalidatePath("/galerie", "page");
}

export async function removeGalleryImage(imageId: string) {
  await requireAdmin();
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
    fallbackImageUrl: sql<string | null>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})::int`
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

// Kuratierte "Best of"-Fotos fuer die Startseite (ueber alle Galerien), in Reihenfolge.
export async function getFavoriteGalleryImages(limit = 8) {
  return await db.select({ gallery: galleries, event: events })
    .from(galleries)
    .leftJoin(events, eq(galleries.eventId, events.id))
    .where(and(eq(galleries.isFavorite, true), isNull(events.deletedAt)))
    .orderBy(asc(galleries.favoriteOrder), asc(galleries.createdAt))
    .limit(limit);
}

export async function setGalleryFavorite(imageId: string, favorite: boolean) {
  await requireAdmin();
  if (favorite) {
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${galleries.favoriteOrder}), 0)` })
      .from(galleries)
      .where(eq(galleries.isFavorite, true));
    await db.update(galleries)
      .set({ isFavorite: true, favoriteOrder: Number(maxOrder) + 1 })
      .where(eq(galleries.id, imageId));
  } else {
    await db.update(galleries).set({ isFavorite: false }).where(eq(galleries.id, imageId));
  }
  revalidatePath("/", "page");
  revalidatePath("/galerie", "page");
  revalidatePath("/admin", "page");
}

// Reihenfolge der Favoriten: tauscht den Platz mit dem Nachbarn in Pfeilrichtung.
export async function moveGalleryFavorite(imageId: string, direction: -1 | 1) {
  await requireAdmin();
  const favorites = await db.select().from(galleries)
    .where(eq(galleries.isFavorite, true))
    .orderBy(asc(galleries.favoriteOrder));
  const idx = favorites.findIndex(f => f.id === imageId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= favorites.length) return;
  const a = favorites[idx];
  const b = favorites[swapIdx];
  await db.update(galleries).set({ favoriteOrder: b.favoriteOrder }).where(eq(galleries.id, a.id));
  await db.update(galleries).set({ favoriteOrder: a.favoriteOrder }).where(eq(galleries.id, b.id));
  revalidatePath("/", "page");
  revalidatePath("/admin", "page");
}

// Bild in einem Favoriten-Slot austauschen: URL/PublicId ersetzen, Favorit + Reihenfolge bleiben.
export async function replaceGalleryImage(imageId: string, imageUrl: string, publicId?: string | null) {
  await requireAdmin();
  await db.update(galleries)
    .set({ imageUrl, publicId: publicId ?? null })
    .where(eq(galleries.id, imageId));
  revalidatePath("/", "page");
  revalidatePath("/galerie", "page");
  revalidatePath("/admin", "page");
}