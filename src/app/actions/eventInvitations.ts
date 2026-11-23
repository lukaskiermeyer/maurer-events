"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BookingError, uuid } from "@/lib/reservation-policy";
import { geocodeAddress, parseCoordsFromText, distanceKm } from "@/lib/geo";
import { emailFrom, emailReplyTo } from "@/lib/email";
import { DEFAULT_INVITE_BODY, DEFAULT_INVITE_SUBJECT, renderInviteMail } from "@/lib/invite-template";
import { revalidatePath } from "next/cache";
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
    .where(and(isNull(customers.deletedAt), inArray(customers.id, ids)));

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
      const mail = renderInviteMail(event.inviteSubject || DEFAULT_INVITE_SUBJECT, event.inviteBody || DEFAULT_INVITE_BODY, {
        name: c.displayName,
        event: event.title,
        datum: event.date ? new Date(event.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        ort: event.location || "",
        link: eventUrl,
      });
      const result = await resend.emails.send(
        {
          from: emailFrom(),
          to: [c.email],
          replyTo: emailReplyTo(),
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
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

export async function saveEventInviteTemplate(params: { eventId: string; subject: string; body: string }) {
  await requireAdmin();
  uuid(params.eventId);
  const subject = params.subject.trim().slice(0, 200);
  const body = params.body.trim().slice(0, 5000);
  if (!subject || !body) return { success: false, error: "Betreff und Text dürfen nicht leer sein." };
  await db.update(events).set({ inviteSubject: subject, inviteBody: body, updatedAt: new Date() }).where(eq(events.id, params.eventId));
  revalidatePath("/[locale]/admin", "layout");
  return { success: true };
}

export async function sendInviteTestMail(eventId: string) {
  const admin = await requireAdmin();
  uuid(eventId);
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new BookingError("Event nicht gefunden.", 404);
  if (!process.env.RESEND_API_KEY) return { success: false, error: "Email not configured" };
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const mail = renderInviteMail(event.inviteSubject || DEFAULT_INVITE_SUBJECT, event.inviteBody || DEFAULT_INVITE_BODY, {
    name: "Max Mustermann",
    event: event.title,
    datum: event.date ? new Date(event.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    ort: event.location || "",
    link: new URL(`/termine/${event.id}`, baseUrl).href,
  });
  const result = await resend.emails.send({
    from: emailFrom(),
    to: [admin.email],
    replyTo: emailReplyTo(),
    subject: `[Test] ${mail.subject}`,
    text: mail.text,
    html: mail.html,
  });
  if (result.error) return { success: false, error: "Email unavailable" };
  return { success: true, to: admin.email };
}