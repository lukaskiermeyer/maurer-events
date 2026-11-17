import { NextResponse } from "next/server";
import { db } from "@/db";
import { festChances } from "@/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const due = await db
    .select()
    .from(festChances)
    .where(and(eq(festChances.leadType, "watch"), isNotNull(festChances.recheckAt), lte(festChances.recheckAt, now)));

  // Reminder email (best effort)
  const recipient = process.env.FEST_CHANCEN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL;
  if (recipient && process.env.RESEND_API_KEY && due.length > 0) {
    try {
      const { Resend } = await import("resend");
      const { emailFrom } = await import("@/lib/email");
      const { renderEmail } = await import("@/lib/email-template");
      const list = due.map((d) => `${d.title || d.sourceUrl} (Score ${d.score}, Recheck ${d.recheckAt?.toISOString().slice(0, 10)})`).join("<br/>");
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: emailFrom(),
        to: [recipient],
        subject: `Fällige Watch-Leads (${due.length})`,
        html: renderEmail({
          title: "Fällige Watch-Leads",
          preheader: `${due.length} Watch-Leads zur erneuten Prüfung.`,
          blocks: [
            { type: "paragraph", text: `Folgende Watch-Leads sind zur erneuten Prüfung fällig (${due.length}):` },
            { type: "paragraph", text: list },
          ],
          footerNote: "Maurer Events · Fest-Chancen",
        }),
      });
    } catch { /* best effort */ }
  }

  return NextResponse.json({ ok: true, due: due.length, ids: due.map((d) => d.id) });
}