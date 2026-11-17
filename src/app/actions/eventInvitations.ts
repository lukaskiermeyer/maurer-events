"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BookingError, uuid } from "@/lib/reservation-policy";
import { geocodeAddress, parseCoordsFromText, distanceKm } from "@/lib/geo";
import { emailFrom } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export interface NearbyCustomer {
  customer: typeof customers.$inferSelect;
  distanceKm: number;
}

export async function findCustomersNearEvent(params: {
  eventId: string;
  radiusKm?: number;
  manualLocation?: string | null;
  marketingOnly?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
  customers?: NearbyCustomer[];
}> {
  await requireAdmin();
  uuid(params.eventId);

  const [event] = await db.select().from(events).where(eq(events.id, params.eventId));
  if (!event) throw new BookingError("Event nicht gefunden.", 404);

  const radius = Math.max(1, Math.min(500, Number(params.radiusKm) || 50));

  let center = null as { lat: number; lng: number } | null;
  if (params.manualLocation && String(params.manualLocation).trim()) {
    center = await geocodeAddress(String(params.manualLocation).trim());
  } else {
    if (event.mapUrl) center = parseCoordsFromText(event.mapUrl) || (await geocodeAddress(event.mapUrl));
    if (!center) center = await geocodeAddress(event.location);
  }

  if (!center) {
    return { success: false, error: "Standort konnte nicht ermittelt werden. Bitte manuelle Eingabe nutzen.", center: null, customers: [] };
  }

  const marketingOnly = params.marketingOnly !== false;

  const rows = await db.select().from(customers).where(isNull(customers.deletedAt));
  const candidates = rows.filter((c) => {
    if (!c.email || !String(c.email).trim()) return false;
    if (marketingOnly && !c.marketingConsent) return false;
    return true;
  });

  // geocode on city/zip level for performance
  const results: NearbyCustomer[] = [];
  const unique = new Map<string, { lat: number; lng: number } | null>();

  for (const c of candidates) {
    const key = [c.zip, c.city].filter(Boolean).join(" ").trim() || [c.street, c.city].filter(Boolean).join(", ").trim();
    if (!key) continue;
    if (!unique.has(key)) {
      unique.set(key, await geocodeAddress(key + ", Deutschland"));
    }
    const cc = unique.get(key);
    if (!cc) continue;
    const d = distanceKm(center, cc);
    if (d <= radius) {
      results.push({ customer: c, distanceKm: Math.round(d * 10) / 10 });
    }
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return { success: true, center, radiusKm: radius, customers: results };
}

export async function sendEventInvitations(params: {
  eventId: string;
  customerIds: string[];
}): Promise<{ success: boolean; error?: string; sent?: number; failed?: number; errors?: string[] }> {
  await requireAdmin();
  uuid(params.eventId);

  const ids = Array.from(new Set((params.customerIds || []).map(String))).slice(0, 1000);
  if (ids.length === 0) return { success: false, error: "Keine Kunden ausgewählt." };

  const [event] = await db.select().from(events).where(eq(events.id, params.eventId));
  if (!event) throw new BookingError("Event nicht gefunden.", 404);

  const rows = await db
    .select()
    .from(customers)
    .where(and(isNull(customers.deletedAt), sql`${customers.id} = ANY(${ids})`));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const eventUrl = new URL(`/termine/${event.id}`, baseUrl).href;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const c of rows) {
    if (!c.email) {
      failed++;
      continue;
    }
    try {
      if (!process.env.RESEND_API_KEY) throw new Error("Email not configured");
      const { escapeHtml } = await import("@/lib/escape");
      const result = await resend.emails.send(
        {
          from: emailFrom(),
          to: [c.email],
          subject: `Neues Fest: ${event.title}`,
          html: renderEmail({
            title: `Neues Fest: ${escapeHtml(event.title)}`,
            preheader: `Wir laden dich ein: ${event.title}`,
            blocks: [
              { type: "paragraph", text: `Hallo ${escapeHtml(c.displayName)},` },
              { type: "paragraph", text: `wir haben ein neues Fest für dich: <b>${escapeHtml(event.title)}</b>.` },
              { type: "paragraph", text: `Ort: ${escapeHtml(event.location)}${event.date ? ` · Datum: ${new Date(event.date).toLocaleDateString("de-DE")}` : ""}` },
              { type: "paragraph", text: "Wir freuen uns, wenn du dabei bist. Reserviere dir jetzt deinen Tisch." },
              { type: "button", label: "Zum Fest & Tisch reservieren", href: escapeHtml(eventUrl) },
            ],
            footerNote: "Maurer Events · Einladung",
          }),
        },
        { idempotencyKey: `event-invite:${event.id}:${c.id}` }
      );
      if (result.error) throw new Error("Email unavailable");
      sent++;
    } catch (err) {
      failed++;
      errors.push(c.displayName);
      console.error("Event invite error:", err instanceof Error ? err.message : err);
    }
  }

  return { success: true, sent, failed, errors };
}