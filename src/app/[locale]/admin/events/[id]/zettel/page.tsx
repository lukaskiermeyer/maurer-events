import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getTables } from "@/app/actions/tables";
import { getReservationsByEvent } from "@/app/actions/reservations";
import { getEventSettings } from "@/app/actions/eventSettings";
import { Link } from "@/i18n/routing";
import StaffHeader from "@/components/admin/StaffHeader";
import SlipCard from "./SlipCard";
import SlipPrintControls from "./SlipPrintControls";

export const dynamic = "force-dynamic";

type NameMode = "full" | "initial" | "club";
type SlipFormat = "a6" | "a5";

function eventDays(event: typeof events.$inferSelect) {
  if (Array.isArray(event.reservableDates) && event.reservableDates.length > 0) {
    return [...new Set(event.reservableDates)].sort();
  }
  const start = new Date(event.date);
  const end = event.endDate ? new Date(event.endDate) : start;
  const days: string[] = [];
  for (let day = new Date(start); day <= end && days.length < 60; day.setDate(day.getDate() + 1)) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days.length ? days : [new Date(event.date).toISOString().slice(0, 10)];
}

export default async function SlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; names?: string; format?: string; filter?: string }>;
}) {
  await requireAdmin(true);
  const { id } = await params;
  const query = await searchParams;
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event || event.deletedAt) notFound();

  const [reservations, tables, settings] = await Promise.all([
    getReservationsByEvent(id),
    getTables(),
    getEventSettings(id),
  ]);
  const days = eventDays(event);
  const selectedDate = query.date && days.includes(query.date) ? query.date : days[0];
  const nameMode: NameMode = query.names === "initial" || query.names === "club" ? query.names : "full";
  const format: SlipFormat = query.format === "a5" ? "a5" : "a6";
  const onlyNew = query.filter === "new";
  const tableById = new Map(tables.map(table => [table.id, table]));

  const visible = reservations.filter(row => {
    const reservation = row.reservation;
    if (!reservation.tableId || !tableById.has(reservation.tableId)) return false;
    if (!["paid", "confirmed"].includes(reservation.status)) return false;
    if (new Date(reservation.reservationDate).toISOString().slice(0, 10) !== selectedDate) return false;
    if (onlyNew && reservation.slipPrintedAt) return false;
    return true;
  }).sort((a, b) => {
    const left = tableById.get(a.reservation.tableId!)!;
    const right = tableById.get(b.reservation.tableId!)!;
    return (left.section || "Zelt").localeCompare(right.section || "Zelt", "de")
      || Number(left.rowLabel || left.positionY) - Number(right.rowLabel || right.positionY)
      || (left.displayNumber || left.name).localeCompare(right.displayNumber || right.name, "de", { numeric: true });
  });

  const note = settings?.slipNote || "Dieser Tisch muss ab 15 Minuten vor der Reservierung freigehalten werden.";
  const dateLabel = new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
  const link = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ date: selectedDate, names: nameMode, format, filter: onlyNew ? "new" : "all", ...patch });
    return `/admin/events/${event.id}/zettel?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-base-light pb-10">
      <div className="no-print"><StaffHeader /></div>
      <main className="max-w-[210mm] mx-auto px-4 pt-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link href={`/admin/events/${event.id}`} className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline">
              &larr; Zurück zum Event
            </Link>
            <h1 className="text-2xl sm:text-4xl font-display font-black text-base-dark mt-2">Reservierungszettel</h1>
            <p className="text-sm text-base-dark/60">{event.title} · {dateLabel}</p>
          </div>
          <SlipPrintControls eventId={event.id} reservationIds={visible.map(row => row.reservation.id)} />
        </div>

        <div className="no-print space-y-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {days.map(day => (
              <Link key={day} href={link({ date: day })} className={`px-4 py-2 rounded-full text-sm font-bold border ${day === selectedDate ? "bg-accent-green text-white border-accent-green" : "bg-white border-border-light hover:border-accent-green"}`}>
                {new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="font-bold text-base-dark/60">Format:</span>
              <Link href={link({ format: "a6" })} className={`px-3 py-1.5 rounded-full border font-bold ${format === "a6" ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>A6 · 4 pro A4</Link>
              <Link href={link({ format: "a5" })} className={`px-3 py-1.5 rounded-full border font-bold ${format === "a5" ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>A5 · 2 pro A4</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="font-bold text-base-dark/60">Name:</span>
              <Link href={link({ names: "full" })} className={`px-3 py-1.5 rounded-full border font-bold ${nameMode === "full" ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>Voll</Link>
              <Link href={link({ names: "initial" })} className={`px-3 py-1.5 rounded-full border font-bold ${nameMode === "initial" ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>Initial</Link>
              <Link href={link({ names: "club" })} className={`px-3 py-1.5 rounded-full border font-bold ${nameMode === "club" ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>Verein</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="font-bold text-base-dark/60">Auswahl:</span>
              <Link href={link({ filter: "all" })} className={`px-3 py-1.5 rounded-full border font-bold ${!onlyNew ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>Alle</Link>
              <Link href={link({ filter: "new" })} className={`px-3 py-1.5 rounded-full border font-bold ${onlyNew ? "bg-base-dark text-white border-base-dark" : "bg-white border-border-light"}`}>Nur neue</Link>
            </div>
          </div>
          <p className="text-sm text-base-dark/60">{visible.length} Zettel. Nach dem Drucken „Als gedruckt markieren“ klicken, damit „Nur neue“ funktioniert.</p>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white border border-border-light rounded-2xl p-10 text-center text-base-dark/60">
            Keine Zettel für diese Auswahl. Prüfe Datum, Status und „Nur neue“.
          </div>
        ) : (
          <div className={`slip-grid ${format === "a5" ? "slip-grid-a5" : "slip-grid-a6"}`}>
            {visible.map(row => (
              <SlipCard
                key={row.reservation.id}
                row={row}
                table={tableById.get(row.reservation.tableId!)!}
                nameMode={nameMode}
                note={note}
                format={format}
                eventTitle={event.title}
              />
            ))}
          </div>
        )}
      </main>

      <style>{`
        @page { size: A4 portrait; margin: 4mm; }
        .slip-grid { display: grid; width: 100%; }
        .slip-grid-a6 { grid-template-columns: repeat(2, 1fr); }
        .slip-grid-a6 .slip-card { aspect-ratio: 105 / 148; }
        .slip-grid-a5 { grid-template-columns: 1fr; }
        .slip-grid-a5 .slip-card { aspect-ratio: 210 / 148; }
        .slip-card { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          html, body { background: #fff !important; }
          nav, header, footer, .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}