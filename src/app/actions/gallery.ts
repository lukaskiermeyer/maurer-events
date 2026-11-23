"use server";

import { db } from "@/db";
import { galleries, galleryAlbums, events } from "@/db/schema";
import { eq, sql, and, or, isNull, isNotNull, asc, desc, lte, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { translateFields } from "@/lib/translate";
import { uuid } from "@/lib/reservation-policy";

const MAX_FAVORITES = 8;

function revalidateGallery() {
  revalidateTag("gallery", "max");
  revalidatePath("/");
  revalidatePath("/galerie");
  revalidatePath("/galerie/[albumId]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/events/[id]", "page");
  revalidatePath("/termine/[id]", "page");
}

// ---------- Alben (öffentlich) ----------

// Galerie-Übersicht: nur vergangene, nicht gelöschte Alben (Galerie = Rückblick).
export const getGalleryAlbums = unstable_cache(async () => {
  const result = await db.select({
    id: galleryAlbums.id,
    title: galleryAlbums.title,
    titleEn: galleryAlbums.titleEn,
    titleBar: galleryAlbums.titleBar,
    date: galleryAlbums.date,
    description: galleryAlbums.description,
    descriptionEn: galleryAlbums.descriptionEn,
    descriptionBar: galleryAlbums.descriptionBar,
    location: galleryAlbums.location,
    locationEn: galleryAlbums.locationEn,
    locationBar: galleryAlbums.locationBar,
    coverImageUrl: galleryAlbums.coverImageUrl,
    fallbackImageUrl: sql<string | null>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})::int`
  })
    .from(galleryAlbums)
    .leftJoin(galleries, eq(galleryAlbums.id, galleries.albumId))
    .where(and(isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date())))
    .groupBy(galleryAlbums.id)
    .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.date));

  return result.map(album => ({
    ...album,
    isFeaturedGallery: true,
    coverImage: album.coverImageUrl || album.fallbackImageUrl,
    imageCount: Number(album.imageCount)
  }));
}, ['public-gallery-albums'], { revalidate: 3600, tags: ['gallery'] });

export const getGalleryAlbumById = unstable_cache(async (albumId: string) => {
  uuid(albumId);
  const [album] = await db.select().from(galleryAlbums)
    .where(and(eq(galleryAlbums.id, albumId), isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date())));
  return album ?? null;
}, ['public-gallery-album-by-id'], { revalidate: 3600, tags: ['gallery'] });

export const getGalleryImages = unstable_cache(async (albumId: string) => {
  uuid(albumId);
  const rows = await db.select({ gallery: galleries }).from(galleries)
    .innerJoin(galleryAlbums, eq(galleryAlbums.id, galleries.albumId))
    .where(and(eq(galleries.albumId, albumId), isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date())))
    .orderBy(asc(galleries.createdAt));
  return rows.map(row => row.gallery);
}, ['public-gallery-images'], { revalidate: 3600, tags: ['gallery'] });

export async function getAdminGalleryImages(albumId: string) {
  await requireAdmin();
  uuid(albumId);
  return db.select().from(galleries).where(eq(galleries.albumId, albumId)).orderBy(asc(galleries.createdAt));
}

// Öffentlich nur Alben vergangener, veröffentlichter Events.
export const getAlbumsForEvent = unstable_cache(async (eventId: string) => {
  uuid(eventId);
  const rows = await db.select({ album: galleryAlbums }).from(galleryAlbums)
    .innerJoin(events, eq(events.id, galleryAlbums.eventId))
    .where(and(eq(galleryAlbums.eventId, eventId), isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date()), isNull(events.deletedAt), eq(events.isPublished, true)))
    .orderBy(asc(galleryAlbums.createdAt));
  return rows.map(row => row.album);
}, ['public-albums-for-event'], { revalidate: 3600, tags: ['gallery'] });

// Bilder aller öffentlich sichtbaren Alben eines Festes.
export const getEventGalleryImages = unstable_cache(async (eventId: string) => {
  uuid(eventId);
  const rows = await db.select({ gallery: galleries }).from(galleries)
    .innerJoin(galleryAlbums, eq(galleryAlbums.id, galleries.albumId))
    .innerJoin(events, eq(events.id, galleryAlbums.eventId))
    .where(and(eq(galleryAlbums.eventId, eventId), isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date()), isNull(events.deletedAt), eq(events.isPublished, true)))
    .orderBy(asc(galleries.createdAt));
  return rows.map(row => row.gallery);
}, ['public-event-gallery-images'], { revalidate: 3600, tags: ['gallery'] });

export async function getAdminEventGalleryImages(eventId: string) {
  await requireAdmin();
  uuid(eventId);
  const albums = await db.select({ id: galleryAlbums.id }).from(galleryAlbums)
    .where(and(eq(galleryAlbums.eventId, eventId), isNull(galleryAlbums.deletedAt)));
  if (albums.length === 0) return [];
  return db.select().from(galleries).where(inArray(galleries.albumId, albums.map(album => album.id))).orderBy(asc(galleries.createdAt));
}

// ---------- Alben (Admin) ----------

export async function getAdminGalleryAlbums() {
  await requireAdmin();
  const result = await db.select({
    album: galleryAlbums,
    fallbackImageUrl: sql<string | null>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})::int`
  })
    .from(galleryAlbums)
    .leftJoin(galleries, eq(galleryAlbums.id, galleries.albumId))
    .where(isNull(galleryAlbums.deletedAt))
    .groupBy(galleryAlbums.id)
    .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.date));

  return result.map(({ album, fallbackImageUrl, imageCount }) => ({
    ...album,
    coverImage: album.coverImageUrl || fallbackImageUrl,
    imageCount: Number(imageCount)
  }));
}

// Einzelnes Album inkl. aufgelöstem Cover + Bildzahl (für Admin-Listen & Mutationen).
async function loadAdminAlbum(id: string) {
  const rows = await db.select({
    album: galleryAlbums,
    fallbackImageUrl: sql<string | null>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})::int`
  })
    .from(galleryAlbums)
    .leftJoin(galleries, eq(galleryAlbums.id, galleries.albumId))
    .where(eq(galleryAlbums.id, id))
    .groupBy(galleryAlbums.id);
  const r = rows[0];
  if (!r) throw new Error('Album nicht gefunden.');
  return { ...r.album, coverImage: r.album.coverImageUrl || r.fallbackImageUrl, imageCount: Number(r.imageCount) };
}

export async function getDeletedGalleryAlbums() {
  await requireAdmin();
  const rows = await db.select({
    album: galleryAlbums,
    fallbackImageUrl: sql<string | null>`min(${galleries.imageUrl})`,
    imageCount: sql<number>`count(${galleries.id})::int`
  })
    .from(galleryAlbums)
    .leftJoin(galleries, eq(galleryAlbums.id, galleries.albumId))
    .where(isNotNull(galleryAlbums.deletedAt))
    .groupBy(galleryAlbums.id)
    .orderBy(desc(galleryAlbums.deletedAt));
  return rows.map(({ album, fallbackImageUrl, imageCount }) => ({
    ...album,
    coverImage: album.coverImageUrl || fallbackImageUrl,
    imageCount: Number(imageCount)
  }));
}

function assertAlbumText(data: { title?: string; location?: string; description?: string }) {
  if (data.title !== undefined && (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 300)) throw new Error('Ungültiger Titel.');
  if (data.location !== undefined && (typeof data.location !== 'string' || !data.location.trim() || data.location.length > 300)) throw new Error('Ungültiger Ort.');
  if (data.description !== undefined && (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 100000)) throw new Error('Ungültige Beschreibung.');
}

export type AlbumTexts = {
  title?: string;
  location?: string;
  description?: string;
  titleEn?: string | null;
  titleBar?: string | null;
  locationEn?: string | null;
  locationBar?: string | null;
  descriptionEn?: string | null;
  descriptionBar?: string | null;
};

const ALBUM_FIELDS = [
  { src: 'title', en: 'titleEn', bar: 'titleBar' },
  { src: 'location', en: 'locationEn', bar: 'locationBar' },
  { src: 'description', en: 'descriptionEn', bar: 'descriptionBar' },
] as const;

export async function createGalleryAlbum(data: {
  title: string;
  date: Date;
  location: string;
  description: string;
  coverImageUrl?: string | null;
  eventId?: string | null;
} & AlbumTexts) {
  await requireAdmin();
  assertAlbumText(data);
  if (!(data.date instanceof Date) || !Number.isFinite(data.date.getTime())) throw new Error('Ungültiges Datum.');
  if (data.eventId) uuid(data.eventId, 'Event-ID');
  const translated = await translateFields({
    title: data.title,
    location: data.location,
    description: data.description,
  });
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${galleryAlbums.sortOrder}), 0)` })
    .from(galleryAlbums);
  const [album] = await db.insert(galleryAlbums).values({
    sortOrder: Number(maxOrder) + 1,
    title: data.title.trim(),
    date: data.date,
    location: data.location.trim(),
    description: data.description,
    coverImageUrl: data.coverImageUrl || null,
    eventId: data.eventId || null,
    titleEn: data.titleEn !== undefined ? data.titleEn : translated.en.title,
    locationEn: data.locationEn !== undefined ? data.locationEn : translated.en.location,
    descriptionEn: data.descriptionEn !== undefined ? data.descriptionEn : translated.en.description,
    titleBar: data.titleBar !== undefined ? data.titleBar : translated.bar.title,
    locationBar: data.locationBar !== undefined ? data.locationBar : translated.bar.location,
    descriptionBar: data.descriptionBar !== undefined ? data.descriptionBar : translated.bar.description,
  }).returning({ id: galleryAlbums.id });
  revalidateGallery();
  return await loadAdminAlbum(album.id);
}

export async function updateGalleryAlbum(id: string, data: {
  date?: Date;
  coverImageUrl?: string | null;
  coverPublicId?: string | null;
} & AlbumTexts) {
  await requireAdmin();
  uuid(id);
  assertAlbumText(data);
  const updates: Partial<typeof galleryAlbums.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.location !== undefined) updates.location = data.location.trim();
  if (data.description !== undefined) updates.description = data.description;
  if (data.date !== undefined) {
    if (!(data.date instanceof Date) || !Number.isFinite(data.date.getTime())) throw new Error('Ungültiges Datum.');
    updates.date = data.date;
  }
  if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl || null;
  if (data.coverPublicId !== undefined) updates.coverPublicId = data.coverPublicId || null;

  // Manuelle EN/Bar-Werte haben Vorrang; KI füllt nur leere Ziele, wenn kein
  // expliziter Wert mitkommt — sonst würden manuelle Korrekturen überschrieben.
  const [cur] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id));
  for (const f of ALBUM_FIELDS) {
    const explicitEn = data[f.en];
    const explicitBar = data[f.bar];
    if (explicitEn !== undefined) updates[f.en] = explicitEn;
    if (explicitBar !== undefined) updates[f.bar] = explicitBar;
    const deChanged = data[f.src] !== undefined;
    const enEmpty = !cur?.[f.en]?.trim();
    const barEmpty = !cur?.[f.bar]?.trim();
    if (deChanged && ((explicitEn === undefined && enEmpty) || (explicitBar === undefined && barEmpty))) {
      const t = await translateFields({ [f.src]: data[f.src] as string });
      if (explicitEn === undefined && enEmpty) updates[f.en] = t.en[f.src];
      if (explicitBar === undefined && barEmpty) updates[f.bar] = t.bar[f.src];
    }
  }

  await db.update(galleryAlbums).set(updates).where(eq(galleryAlbums.id, id));
  revalidateGallery();
  return await loadAdminAlbum(id);
}

// Cover eines Albums auf ein bestimmtes Album-Bild setzen.
export async function setAlbumCoverFromImage(albumId: string, imageId: string) {
  await requireAdmin();
  uuid(albumId); uuid(imageId);
  const [img] = await db.select().from(galleries)
    .where(and(eq(galleries.id, imageId), eq(galleries.albumId, albumId)));
  if (!img) throw new Error('Bild gehört nicht zu diesem Album.');
  await db.update(galleryAlbums)
    .set({ coverImageUrl: img.imageUrl, coverPublicId: img.publicId, updatedAt: new Date() })
    .where(eq(galleryAlbums.id, albumId));
  revalidateGallery();
  return await loadAdminAlbum(albumId);
}

// Soft delete: Album kann innerhalb von 7 Tagen wiederhergestellt werden (Cleanup-Cron).
export async function deleteGalleryAlbum(id: string) {
  await requireAdmin();
  uuid(id);
  await db.update(galleryAlbums).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(galleryAlbums.id, id));
  revalidateGallery();
}

export async function restoreGalleryAlbum(id: string) {
  await requireAdmin();
  uuid(id);
  await db.update(galleryAlbums).set({ deletedAt: null, updatedAt: new Date() }).where(eq(galleryAlbums.id, id));
  revalidateGallery();
  return await loadAdminAlbum(id);
}

export async function getGalleryAlbumDeletionSummary(id: string) {
  await requireAdmin();
  uuid(id);
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(galleries).where(eq(galleries.albumId, id));
  return { images: Number(row?.count ?? 0) };
}

// Album eines Festes holen oder anlegen. Das Event bleibt immer erhalten;
// Titel/Datum/Ort/Beschreibung (inkl. Übersetzungen) werden kopiert.
// Genutzt vom Event-Tab (erster Upload) und von "Album aus Event erstellen".
export async function getOrCreateEventAlbum(eventId: string) {
  await requireAdmin();
  uuid(eventId);
  const [existing] = await db.select({ id: galleryAlbums.id }).from(galleryAlbums)
    .where(and(eq(galleryAlbums.eventId, eventId), isNull(galleryAlbums.deletedAt)))
    .orderBy(asc(galleryAlbums.createdAt))
    .limit(1);
  if (existing) return await loadAdminAlbum(existing.id);

  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error('Event nicht gefunden.');
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${galleryAlbums.sortOrder}), 0)` })
    .from(galleryAlbums);
  const [album] = await db.insert(galleryAlbums).values({
    sortOrder: Number(maxOrder) + 1,
    eventId,
    title: event.title,
    titleEn: event.titleEn,
    titleBar: event.titleBar,
    date: event.date,
    location: event.location,
    locationEn: event.locationEn,
    locationBar: event.locationBar,
    description: event.description,
    descriptionEn: event.descriptionEn,
    descriptionBar: event.descriptionBar,
    coverImageUrl: event.imageUrl,
  }).returning({ id: galleryAlbums.id });
  revalidateGallery();
  return await loadAdminAlbum(album.id);
}

// ---------- Bilder ----------

export async function addGalleryImage(albumId: string | null, imageUrl: string, publicId?: string | null) {
  await requireAdmin();
  if (albumId) uuid(albumId);
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) throw new Error('Ungültige Bild-URL.');
  const [row] = await db.insert(galleries).values({
    albumId: albumId || null,
    imageUrl,
    publicId: publicId ?? null,
  }).returning();
  revalidateGallery();
  return row;
}

export async function removeGalleryImage(imageId: string) {
  await requireAdmin();
  uuid(imageId);
  await db.delete(galleries).where(eq(galleries.id, imageId));
  revalidateGallery();
}

// Bild aus dem Pool einem Album zuordnen (oder zurück in den Pool legen).
export async function assignGalleryImage(imageId: string, albumId: string | null) {
  await requireAdmin();
  uuid(imageId);
  if (albumId) uuid(albumId);
  await db.update(galleries).set({ albumId: albumId || null }).where(eq(galleries.id, imageId));
  revalidateGallery();
}

// Admin-Übersicht: Bilder mit Album (ohne Bilder bereits gelöschter Alben).
export async function getAllGalleryImages() {
  await requireAdmin();
  return await db.select({ gallery: galleries, album: galleryAlbums })
    .from(galleries)
    .leftJoin(galleryAlbums, eq(galleries.albumId, galleryAlbums.id))
    .where(or(isNull(galleryAlbums.id), isNull(galleryAlbums.deletedAt)))
    .orderBy(desc(galleries.createdAt));
}

// ---------- Startseiten-Favoriten ----------

// Kuratierte "Best of"-Fotos fuer die Startseite (ueber alle Alben), in Reihenfolge.
export const getFavoriteGalleryImages = unstable_cache(async (limit = MAX_FAVORITES) => {
  return await db.select({ gallery: galleries, album: galleryAlbums })
    .from(galleries)
    .leftJoin(galleryAlbums, eq(galleries.albumId, galleryAlbums.id))
    .where(and(eq(galleries.isFavorite, true), or(isNull(galleryAlbums.id), and(isNull(galleryAlbums.deletedAt), lte(galleryAlbums.date, new Date())))))
    .orderBy(asc(galleries.favoriteOrder), asc(galleries.createdAt))
    .limit(limit);
}, ['public-favorite-gallery-images'], { revalidate: 3600, tags: ['gallery'] });

export async function setGalleryFavorite(imageId: string, favorite: boolean) {
  await requireAdmin();
  uuid(imageId);
  let updated;
  if (favorite) {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(galleries).where(eq(galleries.isFavorite, true));
    if (Number(row?.count ?? 0) >= MAX_FAVORITES) throw new Error(`Maximal ${MAX_FAVORITES} Favoriten für die Startseite.`);
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${galleries.favoriteOrder}), 0)` })
      .from(galleries)
      .where(eq(galleries.isFavorite, true));
    [updated] = await db.update(galleries)
      .set({ isFavorite: true, favoriteOrder: Number(maxOrder) + 1 })
      .where(eq(galleries.id, imageId))
      .returning();
  } else {
    [updated] = await db.update(galleries)
      .set({ isFavorite: false, favoriteOrder: 0 })
      .where(eq(galleries.id, imageId))
      .returning();
  }
  revalidateGallery();
  return updated;
}

// Reihenfolge der Favoriten: tauscht den Platz mit dem Nachbarn in Pfeilrichtung.
// Gibt die komplette sortierte Favoritenliste ({id, favoriteOrder}) zurück.
export async function moveGalleryFavorite(imageId: string, direction: -1 | 1) {
  await requireAdmin();
  uuid(imageId);
  const favorites = await db.select().from(galleries)
    .where(eq(galleries.isFavorite, true))
    .orderBy(asc(galleries.favoriteOrder));
  const idx = favorites.findIndex(f => f.id === imageId);
  const swapIdx = idx + direction;
  if (idx >= 0 && swapIdx >= 0 && swapIdx < favorites.length) {
    const a = favorites[idx];
    const b = favorites[swapIdx];
    await db.update(galleries).set({ favoriteOrder: b.favoriteOrder }).where(eq(galleries.id, a.id));
    await db.update(galleries).set({ favoriteOrder: a.favoriteOrder }).where(eq(galleries.id, b.id));
    revalidateGallery();
  }
  return await db.select({ id: galleries.id, favoriteOrder: galleries.favoriteOrder })
    .from(galleries).where(eq(galleries.isFavorite, true)).orderBy(asc(galleries.favoriteOrder));
}

// Album-Reihenfolge: tauscht den Platz mit dem Nachbarn in Pfeilrichtung.
// Bestimmt die Anzeige auf /galerie und in der Admin-Liste.
// Gibt die komplette sortierte Albumliste ({id, sortOrder}) zurück.
export async function moveGalleryAlbum(albumId: string, direction: -1 | 1) {
  await requireAdmin();
  uuid(albumId);
  const albums = await db.select({ id: galleryAlbums.id, sortOrder: galleryAlbums.sortOrder })
    .from(galleryAlbums)
    .where(isNull(galleryAlbums.deletedAt))
    .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.date));
  const idx = albums.findIndex(a => a.id === albumId);
  const swapIdx = idx + direction;
  if (idx >= 0 && swapIdx >= 0 && swapIdx < albums.length) {
    const a = albums[idx];
    const b = albums[swapIdx];
    await db.update(galleryAlbums).set({ sortOrder: b.sortOrder }).where(eq(galleryAlbums.id, a.id));
    await db.update(galleryAlbums).set({ sortOrder: a.sortOrder }).where(eq(galleryAlbums.id, b.id));
    revalidateGallery();
  }
  return await db.select({ id: galleryAlbums.id, sortOrder: galleryAlbums.sortOrder })
    .from(galleryAlbums).where(isNull(galleryAlbums.deletedAt))
    .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.date));
}