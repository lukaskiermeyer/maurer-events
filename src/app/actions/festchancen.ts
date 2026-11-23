"use server";

import { db } from "@/db";
import { festOpportunities, festRuns, festChances, vereinsRadar } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type FestOpportunity = typeof festOpportunities.$inferSelect;

export async function getFestOpportunities() {
  await requireAdmin();
  const rows = await db
    .select()
    .from(festOpportunities)
    .where(and(ne(festOpportunities.status, "ignore"), ne(festOpportunities.status, "deleted")))
    .orderBy(desc(festOpportunities.score), desc(festOpportunities.discoveredAt));
  return rows;
}

export async function getFestRuns(limit = 10) {
  await requireAdmin();
  const rows = await db.select().from(festRuns).orderBy(desc(festRuns.createdAt)).limit(limit);
  return rows;
}

export async function getFestChances(leadType?: string) {
  await requireAdmin();
  const notDeleted = ne(festChances.status, "deleted");
  const q = db.select().from(festChances);
  if (leadType) {
    return q.where(and(eq(festChances.leadType, leadType), notDeleted)).orderBy(desc(festChances.score), desc(festChances.discoveredAt));
  }
  return q.where(notDeleted).orderBy(desc(festChances.score), desc(festChances.discoveredAt));
}

export async function getVereinsRadar(status?: string) {
  await requireAdmin();
  const notDeleted = ne(vereinsRadar.status, "deleted");
  const q = db.select().from(vereinsRadar);
  const rows = status
    ? await q.where(and(eq(vereinsRadar.status, status), notDeleted)).orderBy(desc(vereinsRadar.score), desc(vereinsRadar.discoveredAt))
    : await q.where(notDeleted).orderBy(desc(vereinsRadar.score), desc(vereinsRadar.discoveredAt));
  // monthsAhead immer dynamisch gegen das aktuelle Datum berechnen
  const now = new Date();
  return rows.map((row) => {
    if (!row.eventYear) return row;
    const ev = new Date(Date.UTC(row.eventYear, 5, 1));
    const monthsAhead = Math.round((ev.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    return { ...row, monthsAhead };
  });
}

export async function archiveExpiredFestChances() {
  await requireAdmin();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentYear = now.getUTCFullYear();
  const rows = await db
    .select()
    .from(festChances)
    .where(ne(festChances.status, "deleted"));

  const expiredIds = rows
    .filter((r) => {
      if (r.verificationStatus === "expired" || r.verificationStatus === "already_awarded") return true;
      if (r.applicationDeadline && r.applicationDeadline.slice(0, 10) < todayIso) return true;
      if (r.eventDate && r.eventDate.slice(0, 10) < todayIso) return true;
      if (!r.eventDate && r.eventYear != null && r.eventYear < currentYear) return true;
      return false;
    })
    .map((r) => r.id);

  if (expiredIds.length > 0) {
    await db.transaction(async (tx) => {
      for (const id of expiredIds) {
        const row = rows.find((r) => r.id === id);
        await tx.update(festChances).set({ status: "deleted", updatedAt: now }).where(eq(festChances.id, id));
        if (row) {
          await tx
            .update(festOpportunities)
            .set({ status: "ignore", updatedAt: now })
            .where(
              or(
                eq(festOpportunities.urlHash, row.urlHash),
                eq(festOpportunities.sourceUrlNormalized, row.sourceUrlNormalized),
                eq(festOpportunities.sourceUrl, row.sourceUrl),
              ),
            );
        }
      }
    });
  }
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true, archived: expiredIds.length };
}

export async function updateVereinsRadarStatus(id: string, status: string) {
  await requireAdmin();
  await db.update(vereinsRadar).set({ status, updatedAt: new Date() }).where(eq(vereinsRadar.id, id));
  revalidatePath("/[locale]/admin/vereins-radar", "page");
  return { ok: true };
}

export async function updateFestOpportunityStatus(id: string, status: string) {
  await requireAdmin();
  await db.update(festOpportunities).set({ status, updatedAt: new Date() }).where(eq(festOpportunities.id, id));
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

// Soft-Delete: Die Zeile bleibt für das Dedupe-Matching erhalten, damit der
// Ingest sie bei künftigen Läufen überspringt statt neu anzulegen.
export async function deleteFestChance(id: string) {
  await requireAdmin();
  const [row] = await db.select().from(festChances).where(eq(festChances.id, id)).limit(1);
  if (!row) return { ok: false, error: "not_found" };
  await db.transaction(async (tx) => {
    await tx.update(festChances).set({ status: "deleted", updatedAt: new Date() }).where(eq(festChances.id, id));
    await tx
      .update(festOpportunities)
      .set({ status: "ignore", updatedAt: new Date() })
      .where(
        or(
          eq(festOpportunities.urlHash, row.urlHash),
          eq(festOpportunities.sourceUrlNormalized, row.sourceUrlNormalized),
          eq(festOpportunities.sourceUrl, row.sourceUrl),
        ),
      );
  });
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

export async function deleteFestOpportunity(id: string) {
  await requireAdmin();
  const [row] = await db.select().from(festOpportunities).where(eq(festOpportunities.id, id)).limit(1);
  if (!row) return { ok: false, error: "not_found" };
  await db.transaction(async (tx) => {
    await tx.update(festOpportunities).set({ status: "ignore", updatedAt: new Date() }).where(eq(festOpportunities.id, id));
    await tx
      .update(festChances)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(or(eq(festChances.urlHash, row.urlHash), eq(festChances.sourceUrl, row.sourceUrl)));
  });
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

export async function updateFestChanceWirt(id: string, wirtStatus: string, wirtNotiz?: string | null, wiedervorlage?: string | null) {
  await requireAdmin();
  await db.update(festChances).set({
    wirtStatus,
    wirtNotiz: wirtNotiz ?? undefined,
    wiedervorlage: wiedervorlage ? new Date(wiedervorlage + "T00:00:00Z") : (wiedervorlage === null ? null : undefined),
    updatedAt: new Date(),
  }).where(eq(festChances.id, id));
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

export async function updateVereinsRadarWirt(id: string, wirtStatus: string, wirtNotiz?: string | null, wiedervorlage?: string | null) {
  await requireAdmin();
  await db.update(vereinsRadar).set({
    wirtStatus,
    wirtNotiz: wirtNotiz ?? undefined,
    wiedervorlage: wiedervorlage ? new Date(wiedervorlage + "T00:00:00Z") : (wiedervorlage === null ? null : undefined),
    updatedAt: new Date(),
  }).where(eq(vereinsRadar.id, id));
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

// Soft-Delete: Die Zeile bleibt als Tombstone erhalten, damit der Radar-Ingest
// sie bei künftigen Läufen überspringt statt neu anzulegen (wie deleteFestChance).
export async function deleteVereinsRadar(id: string) {
  await requireAdmin();
  await db.update(vereinsRadar).set({ status: "deleted", updatedAt: new Date() }).where(eq(vereinsRadar.id, id));
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

export async function triggerN8nWebhook(mode: "fest" | "radar" = "fest") {
  await requireAdmin();
  const url = process.env.N8N_WEBHOOK_URL || "https://n8n.travellui.com/webhook/festfinder-start";
  const token = (process.env.MAURER_API_KEY || process.env.FEST_CHANCEN_INGEST_TOKEN || "").trim();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": token },
      body: JSON.stringify({ triggeredBy: "admin", mode, at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}