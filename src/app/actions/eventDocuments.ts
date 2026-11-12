"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eventDocuments, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/reservation-policy";
import type { EventDocument } from "@/types/domain";

export async function getPublicEventDocuments(eventId: string): Promise<EventDocument[]> {
  uuid(eventId);
  return db.select({ document: eventDocuments }).from(eventDocuments)
    .innerJoin(events, eq(events.id, eventDocuments.eventId))
    .where(and(eq(eventDocuments.eventId, eventId), eq(eventDocuments.isPublic, true), isNull(events.deletedAt)))
    .orderBy(asc(eventDocuments.kind), asc(eventDocuments.sortOrder), asc(eventDocuments.createdAt))
    .then(rows => rows.map(row => row.document));
}

export async function getPublicEventDocumentsForEvents(): Promise<Record<string, EventDocument[]>> {
  const rows = await db.select({ document: eventDocuments }).from(eventDocuments)
    .innerJoin(events, eq(events.id, eventDocuments.eventId))
    .where(and(eq(eventDocuments.isPublic, true), isNull(events.deletedAt)))
    .orderBy(asc(eventDocuments.kind), asc(eventDocuments.sortOrder), asc(eventDocuments.createdAt));
  return rows.reduce<Record<string, EventDocument[]>>((map, row) => {
    (map[row.document.eventId] ||= []).push(row.document);
    return map;
  }, {});
}

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
  revalidatePath("/[locale]", "layout");
  return { success: true };
}