"use server";

import { db } from "@/db";
import { waitlists, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export async function joinWaitlist(data: {
  eventId: string;
  name: string;
  email: string;
  guestCount: number;
}) {
  try {
    await db.insert(waitlists).values({
      eventId: data.eventId,
      name: data.name,
      email: data.email,
      guestCount: data.guestCount,
    });
    
    // We don't need strict revalidation for the frontend here, but we revalidate admin
    revalidatePath(`/admin/events/${data.eventId}`);
    return { success: true };
  } catch (err) {
    console.error("Waitlist error:", err);
    return { success: false, error: "Fehler beim Eintragen in die Warteliste." };
  }
}

export async function getWaitlist(eventId: string) {
  return await db.select().from(waitlists).where(eq(waitlists.eventId, eventId));
}

export async function notifyWaitlistEntry(entryId: string) {
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

    if (process.env.RESEND_API_KEY && waitlist.email) {
      await resend.emails.send({
        from: "Maurer Events <servus@maurer-events.com>",
        to: [waitlist.email],
        subject: `Gute Neuigkeiten! Ein Tisch für ${eventTitle} ist frei!`,
        html: `<p>Hallo ${waitlist.name},</p><p>Es ist wieder ein Tisch für <b>${eventTitle}</b> verfügbar geworden!</p><p>Bitte besuche umgehend unsere Website, um dir den Platz zu sichern, bevor er wieder vergeben ist.</p><p><a href="https://maurer-events.com/termine/${waitlist.eventId}">Jetzt Tisch reservieren</a></p>`,
      });
    }

    await db.update(waitlists).set({ notifiedAt: new Date() }).where(eq(waitlists.id, entryId));
    revalidatePath(`/admin/events/${waitlist.eventId}`);

    return { success: true };
  } catch (err) {
    console.error("Notify waitlist error:", err);
    return { success: false, error: "Fehler beim Senden der Benachrichtigung." };
  }
}

export async function removeWaitlistEntry(entryId: string, eventId: string) {
  await db.delete(waitlists).where(eq(waitlists.id, entryId));
  revalidatePath(`/admin/events/${eventId}`);
}
