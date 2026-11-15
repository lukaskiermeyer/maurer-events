import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events, staff, staffAssignments, staffRoles } from "@/db/schema";
import { staffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";

function pad(n: number) { return String(n).padStart(2, "0"); }

function toIcsDate(date: Date | string, time: string) {
  const d = new Date(date);
  const [hh, mm] = (time || "00:00").split(":").map(x => parseInt(x, 10));
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}${m}${day}T${pad(hh || 0)}${pad(mm || 0)}00`;
}

export async function GET() {
  const store = await cookies();
  const token = store.get("staff_token")?.value;
  const row = await staffSession(token);
  if (!row) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  const member = row.member;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ assignment: staffAssignments, event: events, role: staffRoles })
    .from(staffAssignments)
    .innerJoin(events, eq(events.id, staffAssignments.eventId))
    .leftJoin(staffRoles, eq(staffRoles.id, staffAssignments.roleId))
    .where(and(eq(staffAssignments.staffId, member.id), gte(staffAssignments.date, today), isNull(events.deletedAt)));

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Maurer Events//Schichten//DE");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:Maurer Events - Meine Schichten");
  lines.push("X-WR-TIMEZONE:Europe/Berlin");

  for (const r of rows) {
    const a = r.assignment;
    const ev = r.event;
    const uid = `${a.id}@maurer-events`;
    const summary = `${ev.title} - ${r.role?.name || "Schicht"}`;
    const description = `Status: ${a.status}\\nRolle: ${r.role?.name || "—"}\\nQuelle: ${a.source}`;
    const location = ev.location || "";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    lines.push(`DTSTART;TZID=Europe/Berlin:${toIcsDate(a.date, a.startTime)}`);
    lines.push(`DTEND;TZID=Europe/Berlin:${toIcsDate(a.date, a.endTime)}`);
    lines.push(`SUMMARY:${escapeIcs(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcs(description)}`);
    if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
    // Reminder 1 day before
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-P1D");
    lines.push("ACTION:DISPLAY");
    lines.push("DESCRIPTION:Erinnerung: Schicht morgen");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="maurer-events-schichten.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
