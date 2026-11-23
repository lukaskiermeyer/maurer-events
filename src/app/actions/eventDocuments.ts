"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/db";
import { eventDocuments, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { deleteCloudinaryImage } from "@/lib/cloudinary";
import { uuid } from "@/lib/reservation-policy";
import { translateFields } from "@/lib/translate";
import type { EventDocument } from "@/types/domain";

export const getPublicEventDocuments = unstable_cache(async (eventId: string): Promise<EventDocument[]> => {
  uuid(eventId);
  return db.select({ document: eventDocuments }).from(eventDocuments)
    .innerJoin(events, eq(events.id, eventDocuments.eventId))
    .where(and(eq(eventDocuments.eventId, eventId), eq(eventDocuments.isPublic, true), isNull(events.deletedAt)))
    .orderBy(asc(eventDocuments.kind), asc(eventDocuments.sortOrder), asc(eventDocuments.createdAt))
    .then(rows => rows.map(row => row.document));
}, ['public-event-documents'], { revalidate: 3600, tags: ['event-documents'] });

export const getPublicEventDocumentsForEvents = unstable_cache(async (): Promise<Record<string, EventDocument[]>> => {
  const rows = await db.select({ document: eventDocuments }).from(eventDocuments)
    .innerJoin(events, eq(events.id, eventDocuments.eventId))
    .where(and(eq(eventDocuments.isPublic, true), isNull(events.deletedAt)))
    .orderBy(asc(eventDocuments.kind), asc(eventDocuments.sortOrder), asc(eventDocuments.createdAt));
  return rows.reduce<Record<string, EventDocument[]>>((map, row) => {
    (map[row.document.eventId] ||= []).push(row.document);
    return map;
  }, {});
}, ['public-event-documents-for-events'], { revalidate: 3600, tags: ['event-documents'] });

export async function getAdminEventDocuments(eventId: string): Promise<EventDocument[]> {
  await requireAdmin();
  uuid(eventId);
  return db.select().from(eventDocuments).where(eq(eventDocuments.eventId, eventId))
    .orderBy(asc(eventDocuments.kind), asc(eventDocuments.sortOrder), asc(eventDocuments.createdAt));
}

export async function deleteEventDocument(id: string) {
  await requireAdmin();
  uuid(id);
  const [document] = await db.select().from(eventDocuments).where(eq(eventDocuments.id, id));
  if (!document) throw new Error("Dokument nicht gefunden.");
  await db.delete(eventDocuments).where(eq(eventDocuments.id, id));
  // Cloudinary-Asset (inkl. abgeleitete Versionen) best effort purgen.
  for (const url of [document.fileUrl, document.previewUrl].filter((u): u is string => Boolean(u))) {
    try { await deleteCloudinaryImage(url); } catch { /* best effort */ }
  }
  revalidateTag("event-documents", "max");
  revalidatePath("/[locale]", "layout");
  return { success: true };
}

// Manuelle EN/Bar-Titel eines Dokuments setzen (leer = null, damit die KI sie
// spaeter fuellen kann). Laengenbegrenzung wie beim Upload (150 Zeichen).
export async function updateEventDocumentTranslations(id: string, data: { titleEn?: string | null; titleBar?: string | null }) {
  await requireAdmin();
  uuid(id);
  const titleEn = data.titleEn ?? null;
  const titleBar = data.titleBar ?? null;
  if (titleEn !== null && (typeof titleEn !== "string" || titleEn.length > 150)) throw new Error("Ungültiger Titel (EN).");
  if (titleBar !== null && (typeof titleBar !== "string" || titleBar.length > 150)) throw new Error("Ungültiger Titel (Bairisch).");
  await db.update(eventDocuments).set({ titleEn, titleBar }).where(eq(eventDocuments.id, id));
  revalidateTag("event-documents", "max");
  revalidatePath("/[locale]", "layout");
  return { success: true };
}

// On-Demand-Uebersetzung eines Dokuments: fuellt nur leere Titel-Felder.
export async function translateEventDocument(id: string) {
  await requireAdmin();
  uuid(id);
  const [doc] = await db.select().from(eventDocuments).where(eq(eventDocuments.id, id));
  if (!doc) throw new Error("Dokument nicht gefunden.");
  const t = await translateFields({ title: doc.title });
  const titleEn = doc.titleEn && doc.titleEn.trim() ? doc.titleEn : t.en.title;
  const titleBar = doc.titleBar && doc.titleBar.trim() ? doc.titleBar : t.bar.title;
  await db.update(eventDocuments).set({ titleEn, titleBar }).where(eq(eventDocuments.id, id));
  revalidateTag("event-documents", "max");
  revalidatePath("/[locale]", "layout");
  return { titleEn: titleEn ?? "", titleBar: titleBar ?? "" };
}