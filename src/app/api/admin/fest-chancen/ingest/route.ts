import { NextResponse } from "next/server";
import { db } from "@/db";
import { festOpportunities, festRuns } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ITEMS = 200;

function getApiKey(): string {
  return process.env.MAURER_N8N_KEY || process.env.MAURER_API_KEY || "";
}

export async function POST(request: Request) {
  const expected = getApiKey();
  if (!expected) {
    return NextResponse.json({ error: "Server not configured (MAURER_N8N_KEY missing)." }, { status: 500 });
  }
  const provided = request.headers.get("x-n8n-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : (body && Array.isArray((body as any).items) ? (body as any).items : null);
  if (!items) {
    return NextResponse.json({ error: "Expected JSON array of opportunities" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Too many items (max ${MAX_ITEMS})` }, { status: 413 });
  }

  const runId = (items[0] && (items[0] as any).runId) ? String((items[0] as any).runId) : `run-${Date.now()}`;

  let synced = 0;
  const errors: string[] = [];

  for (const raw of items) {
    const o = raw as Record<string, unknown>;
    const sourceUrl = String(o.sourceUrl || "").trim();
    if (!sourceUrl) { errors.push("missing sourceUrl"); continue; }

    const values = {
      title: o.title ? String(o.title) : null,
      organizer: o.organizer ? String(o.organizer) : null,
      location: o.location ? String(o.location) : null,
      region: o.region ? String(o.region) : null,
      eventDate: o.eventDate ? new Date(String(o.eventDate)) : null,
      jubileeYears: typeof o.jubileeYears === "number" ? o.jubileeYears : (o.jubileeYears ? Number(o.jubileeYears) : null),
      categories: Array.isArray(o.categories) ? o.categories : [],
      contactName: o.contactName ? String(o.contactName) : null,
      contactEmail: o.contactEmail ? String(o.contactEmail) : null,
      contactPhone: o.contactPhone ? String(o.contactPhone) : null,
      sourceUrl,
      sourceUrlNormalized: o.sourceUrlNormalized ? String(o.sourceUrlNormalized) : sourceUrl.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, ""),
      festwirtStatus: ["open", "unknown", "taken", "closed"].includes(String(o.festwirtStatus)) ? String(o.festwirtStatus) : "unknown",
      score: typeof o.score === "number" ? o.score : Number(o.score || 0),
      scoreReason: o.scoreReason ? String(o.scoreReason) : null,
      monthsAhead: typeof o.monthsAhead === "number" ? o.monthsAhead : (o.monthsAhead ? Number(o.monthsAhead) : null),
      status: ["new", "reviewing", "applied", "contacted", "won", "lost", "ignore"].includes(String(o.status)) ? String(o.status) : "new",
      nextAction: o.nextAction ? String(o.nextAction) : null,
      discoveredAt: o.discoveredAt ? new Date(String(o.discoveredAt)) : new Date(),
      n8nRunId: o.runId ? String(o.runId) : runId,
      updatedAt: new Date(),
    };

    try {
      await db.insert(festOpportunities).values(values).onConflictDoUpdate({
        target: festOpportunities.sourceUrl,
        set: {
          title: values.title,
          organizer: values.organizer,
          location: values.location,
          region: values.region,
          eventDate: values.eventDate,
          jubileeYears: values.jubileeYears,
          categories: values.categories,
          contactName: values.contactName,
          contactEmail: values.contactEmail,
          contactPhone: values.contactPhone,
          festwirtStatus: values.festwirtStatus,
          score: values.score,
          scoreReason: values.scoreReason,
          monthsAhead: values.monthsAhead,
          discoveredAt: values.discoveredAt,
          n8nRunId: values.n8nRunId,
          updatedAt: new Date(),
        },
      });
      synced++;
    } catch (e) {
      errors.push(`${sourceUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Record run
  try {
    await db.insert(festRuns).values({
      runId,
      startedAt: new Date(),
      foundCount: items.length,
      syncedCount: synced,
      error: errors.length ? errors.join("; ").slice(0, 2000) : null,
    }).onConflictDoUpdate({
      target: festRuns.runId,
      set: { foundCount: items.length, syncedCount: synced, error: errors.length ? errors.join("; ").slice(0, 2000) : null },
    });
  } catch (e) {
    console.error("fest_runs insert failed", e);
  }

  return NextResponse.json({ ok: true, runId, received: items.length, synced, errors });
}