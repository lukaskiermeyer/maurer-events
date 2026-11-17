"use server";

import { db } from "@/db";
import { festOpportunities, festRuns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type FestOpportunity = typeof festOpportunities.$inferSelect;

export async function getFestOpportunities() {
  await requireAdmin();
  const rows = await db.select().from(festOpportunities).orderBy(desc(festOpportunities.score), desc(festOpportunities.discoveredAt));
  return rows;
}

export async function getFestRuns(limit = 10) {
  await requireAdmin();
  const rows = await db.select().from(festRuns).orderBy(desc(festRuns.createdAt)).limit(limit);
  return rows;
}

export async function updateFestOpportunityStatus(id: string, status: string) {
  await requireAdmin();
  await db.update(festOpportunities).set({ status, updatedAt: new Date() }).where(eq(festOpportunities.id, id));
  revalidatePath("/[locale]/admin/festchancen", "page");
  return { ok: true };
}

export async function triggerN8nWebhook() {
  await requireAdmin();
  const url = process.env.N8N_WEBHOOK_URL || "https://n8n.travellui.com/webhook/festfinder-start";
  const token = process.env.MAURER_API_KEY || "";
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": token }, body: JSON.stringify({ triggeredBy: "admin", at: new Date().toISOString() }) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}