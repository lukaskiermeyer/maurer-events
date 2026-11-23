"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { planPresets, events, reservations, tables } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/reservation-policy";
import { deliverTicket } from "@/lib/ticket-delivery";
import { isLayout, findTable, type PlanLayout } from "@/lib/plan-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertLayout(layout: unknown): asserts layout is PlanLayout {
  if (!isLayout(layout)) throw new Error('Ungültiges Plan-Format.');
  if (layout.widthCm < 100 || layout.widthCm > 100000 || layout.heightCm < 100 || layout.heightCm > 100000) {
    throw new Error('Planfläche muss zwischen 1 m und 1000 m liegen.');
  }
  if (layout.elements.length > 5000) throw new Error('Zu viele Elemente (max. 5000).');
  if (!/^[A-Za-zÄÖÜäöü0-9-]{0,6}$/.test(layout.tablePrefix)) throw new Error('Ungültiges Tisch-Präfix.');
}

export async function getPlanPresets() {
  await requireAdmin();
  return db.select().from(planPresets).orderBy(desc(planPresets.updatedAt));
}

export async function savePlanPreset(input: { id?: string | null; name: string; description?: string | null; layout: PlanLayout }) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error('Name muss 1–80 Zeichen lang sein.');
  assertLayout(input.layout);
  const values = { name, description: input.description?.trim() || null, layout: input.layout, updatedAt: new Date() };
  let id = input.id ?? null;
  if (id) {
    uuid(id);
    await db.update(planPresets).set(values).where(eq(planPresets.id, id));
  } else {
    const [row] = await db.insert(planPresets).values(values).returning({ id: planPresets.id });
    id = row.id;
  }
  revalidatePath('/[locale]/admin/tischplaene');
  revalidatePath('/[locale]/admin', 'layout');
  return { id };
}

export async function deletePlanPreset(id: string) {
  await requireAdmin();
  uuid(id);
  const used = await db.select({ title: events.title }).from(events).where(eq(events.planPresetId, id));
  if (used.length > 0) {
    throw new Error(`Preset wird noch verwendet von: ${used.map(e => e.title).join(', ')}. Erst dort ein anderes Preset wählen.`);
  }
  await db.delete(planPresets).where(eq(planPresets.id, id));
  revalidatePath('/[locale]/admin/tischplaene');
  return { success: true };
}

export async function duplicatePlanPreset(id: string) {
  await requireAdmin();
  uuid(id);
  const [source] = await db.select().from(planPresets).where(eq(planPresets.id, id));
  if (!source) throw new Error('Preset nicht gefunden.');
  const [row] = await db.insert(planPresets).values({
    name: `${source.name} (Kopie)`.slice(0, 80),
    description: source.description,
    layout: source.layout,
  }).returning({ id: planPresets.id });
  revalidatePath('/[locale]/admin/tischplaene');
  return { id: row.id };
}

export async function setEventPlan(eventId: string, presetId: string | null) {
  await requireAdmin();
  uuid(eventId);
  if (presetId) {
    uuid(presetId);
    const [preset] = await db.select({ id: planPresets.id }).from(planPresets).where(eq(planPresets.id, presetId));
    if (!preset) throw new Error('Preset nicht gefunden.');
  }
  await db.update(events).set({ planPresetId: presetId, updatedAt: new Date() }).where(eq(events.id, eventId));
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true };
}

export async function getEventPlan(eventId: string) {
  await requireAdmin();
  uuid(eventId);
  const [event] = await db.select({ planPresetId: events.planPresetId }).from(events).where(eq(events.id, eventId));
  if (!event?.planPresetId) return null;
  const [preset] = await db.select().from(planPresets).where(eq(planPresets.id, event.planPresetId));
  return preset ?? null;
}

// Zuweisung im neuen Plan: plan_table_id ist autoritativ. Ist die Element-ID
// eine bestehende Tisch-UUID (Bestand-Preset), bleibt table_id synchron, damit
// Zettel/Scanner/Ticket-Versand unverändert weiterlaufen.
export async function assignPlanTable(reservationId: string, planTableId: string | null) {
  await requireAdmin();
  uuid(reservationId);
  const [reservation] = await db.select({ id: reservations.id, eventId: reservations.eventId, planTableId: reservations.planTableId, tableId: reservations.tableId, qrCodeText: reservations.qrCodeText }).from(reservations).where(eq(reservations.id, reservationId));
  if (!reservation) throw new Error('Reservierung nicht gefunden.');

  let legacyTableId: string | null = null;
  if (planTableId) {
    const preset = await getEventPlan(reservation.eventId);
    if (!preset) throw new Error('Dieses Event hat noch kein Plan-Preset gewählt.');
    const table = findTable(preset.layout, planTableId);
    if (!table) throw new Error('Tisch nicht im Plan gefunden.');
    if (table.blocked) throw new Error('Dieser Tisch ist gesperrt.');
    if (UUID_RE.test(planTableId)) {
      const [legacy] = await db.select({ id: tables.id }).from(tables).where(eq(tables.id, planTableId));
      legacyTableId = legacy?.id ?? null;
    }
  }
  // Tischwechsel: altes Ticket (QR + eingefrorene Mail) ungültig machen, damit
  // die neue Bestätigung den richtigen Tisch trägt und als ToDo erscheint.
  const changed = reservation.planTableId !== planTableId || reservation.tableId !== legacyTableId;
  await db.update(reservations).set({
    planTableId,
    tableId: legacyTableId,
    updatedAt: new Date(),
    ...(changed ? { qrCodeText: reservation.qrCodeText ? randomUUID() : null, ticketEmailPayload: null, ticketSentAt: null } : {}),
  }).where(eq(reservations.id, reservationId));
  const warning = planTableId ? await deliverTicket(reservationId) : undefined;
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, warning };
}