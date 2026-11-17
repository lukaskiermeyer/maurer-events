import { db } from "@/db";
import { emailLog, staff } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderEmail } from "@/lib/email-template";
import { escapeHtml } from "@/lib/escape";

export async function sendStaffAssignmentEmail(params: {
  staffId: string;
  eventTitle: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  roleName: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY missing" };

  const [member] = await db.select().from(staff).where(eq(staff.id, params.staffId));
  if (!member?.email) return { sent: false, error: "Keine E-Mail-Adresse" };

  const from = process.env.EMAIL_FROM || "Maurer Events <servus@maurer-events.com>";
  const subject = `Neue Schichtzuweisung: ${params.eventTitle}`;
  const dateLabel = new Date(params.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const html = renderEmail({
    title: "Neue Schichtzuweisung",
    preheader: `Schicht für ${params.eventTitle}`,
    blocks: [
      { type: "paragraph", text: `Hallo ${escapeHtml(member.firstName)},` },
      { type: "paragraph", text: "du wurdest für folgende Schicht eingeteilt:" },
      { type: "list", items: [
        `<strong>Veranstaltung:</strong> ${escapeHtml(params.eventTitle)}`,
        `<strong>Rolle:</strong> ${escapeHtml(params.roleName)}`,
        `<strong>Datum:</strong> ${escapeHtml(dateLabel)}`,
        `<strong>Zeit:</strong> ${escapeHtml(params.startTime)}–${escapeHtml(params.endTime)}`,
      ] },
      { type: "button", label: "Schicht ansehen", href: (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000") + "/team/schichten" },
    ],
    footerNote: "Maurer Events · Schichtplanung",
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [member.email], subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      await db.insert(emailLog).values({ toEmail: member.email, subject, category: "staff_assignment", status: "failed", error: text.slice(0, 500) });
      return { sent: false, error: text };
    }
    await db.insert(emailLog).values({ toEmail: member.email, subject, category: "staff_assignment", status: "sent" });
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.insert(emailLog).values({ toEmail: member.email, subject, category: "staff_assignment", status: "failed", error: msg.slice(0, 500) });
    return { sent: false, error: msg };
  }
}