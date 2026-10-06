"use server";

import { db } from "@/db";
import { waitlists, events } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/auth";

import { guestDetails, uuid } from '@/lib/reservation-policy';
import { verifyTurnstile } from '@/lib/turnstile';
import { takeRateLimit } from '@/lib/rate-limit';
import { enterWaitlist } from '@/lib/waitlist';
const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export async function joinWaitlist(data: { eventId: string; name: string; email: string; guestCount: number; turnstileToken: string }) {
  try {
    const eventId = uuid(data?.eventId);
    const details = guestDetails(data?.name, data?.email, data?.guestCount);
    await verifyTurnstile(data?.turnstileToken, 'waitlist');
    if (!await takeRateLimit(`waitlist:${details.email}`, 5, 15 * 60000)) return { success: false, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' };
    await enterWaitlist(db, { ...data, eventId, email: details.email });
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true };
  } catch { return { success: false, error: 'Fehler beim Eintragen in die Warteliste.' }; }
}
export async function getWaitlist(eventId: string) {
  await requireAdmin(); uuid(eventId);
  return await db.select().from(waitlists).where(eq(waitlists.eventId, eventId));
}

export async function notifyWaitlistEntry(entryId: string) {
  await requireAdmin(); uuid(entryId);
  try {
    const entryList = await db.select({
      waitlist: waitlists,
      eventTitle: events.title,
    })
    .from(waitlists)
    .leftJoin(events, eq(waitlists.eventId, events.id))
    .where(eq(waitlists.id, entryId));

    if (entryList.length === 0) return { success: false, error: "Eintrag nicht gefunden." };

    const { waitlist, eventTitle } = entryList[0];
    if (waitlist.notifiedAt) return { success: true };
    const { escapeHtml } = await import("@/lib/escape");

    if (process.env.RESEND_API_KEY && waitlist.email) {
      const result = await resend.emails.send({
        from: "Maurer Events <servus@maurer-events.com>",
        to: [waitlist.email],
        subject: `Gute Neuigkeiten! Ein Tisch für ${escapeHtml(eventTitle)} ist frei!`,
        html: `<p>Hallo ${escapeHtml(waitlist.name)},</p><p>Es ist wieder ein Tisch für <b>${escapeHtml(eventTitle)}</b> verfügbar geworden!</p><p>Bitte besuche umgehend unsere Website, um dir den Platz zu sichern, bevor er wieder vergeben ist.</p><p><a href="https://maurer-events.com/termine/${waitlist.eventId}">Jetzt Tisch reservieren</a></p>`,
      }, { idempotencyKey: `waitlist:${waitlist.id}` });
      if (result.error) throw new Error('Email unavailable');
    } else throw new Error('Email not configured');

    await db.update(waitlists).set({ notifiedAt: new Date() }).where(eq(waitlists.id, entryId));
    revalidatePath(`/admin/events/${waitlist.eventId}`);

    return { success: true };
  } catch (err) {
    console.error("Notify waitlist error:", (err as any).message);
    return { success: false, error: "Fehler beim Senden der Benachrichtigung." };
  }
}

export async function removeWaitlistEntry(entryId: string, eventId: string) {
  await requireAdmin(); uuid(entryId); uuid(eventId);
  await db.delete(waitlists).where(and(eq(waitlists.id, entryId), eq(waitlists.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}`);
}
