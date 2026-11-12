import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getTables, getBookedTableIds } from "@/app/actions/tables";
import { getReservationsByEvent } from "@/app/actions/reservations";
import { getCustomers } from "@/app/actions/customers";
import { getTentSettings } from "@/app/actions/settings";
import { Link } from "@/i18n/routing";
import StaffHeader from "@/components/admin/StaffHeader";
import PlanSvg from "./PlanSvg";
import PrintPlanButton from "./PrintPlanButton";
import CustomerAssignPanel from "./CustomerAssignPanel";

export const dynamic = "force-dynamic";

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

export default async function TablePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  await requireAdmin(true);
  const { id } = await params;
  const query = await searchParams;
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event || event.deletedAt) notFound();

  const [tables, reservations, tent] = await Promise.all([
    getTables(),
    getReservationsByEvent(id),
    getTentSettings(),
  ]);

  const days = eventDays(event);
  const selectedDate = query.date && days.includes(query.date) ? query.date : days[0];
  const mode = query.mode === "public" ? "public" : "internal";
  const visibleReservations = reservations.filter(row => {
    const reservation = row.reservation;
    return reservation.tableId
      && ["paid", "confirmed", "checked_in"].includes(reservation.status)
      && new Date(reservation.reservationDate).toISOString().slice(0, 10) === selectedDate;
  });
  const reservedCount = visibleReservations.length;
  const dateLabel = new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const [customers, bookedTableIds] = await Promise.all([
    getCustomers(),
    getBookedTableIds(id, selectedDate).catch(() => [] as string[]),
  ]);

  return (
    <div className="min-h-screen bg-base-light pb-10">
      <div className="no-print"><StaffHeader /></div>
      <main className="plan-page max-w-[1400px] mx-auto px-4 pt-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link href={`/admin/events/${event.id}`} className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline">
              &larr; Zurück zum Event
            </Link>
            <h1 className="text-2xl sm:text-4xl font-display font-black text-base-dark mt-2">{event.title}</h1>
            <p className="text-sm text-base-dark/60">Tischplan · {dateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintPlanButton />
            <Link
              href={`/admin/events/${event.id}/tischplan?date=${selectedDate}&mode=${mode === "internal" ? "public" : "internal"}`}
              className="min-h-12 inline-flex items-center px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors"
            >
              {mode === "internal" ? "Öffentliche Version" : "Interne Version"}
            </Link>
          </div>
        </div>

        <CustomerAssignPanel
          customers={customers}
          tables={tables}
          bookedTableIds={(bookedTableIds as string[]).map(String)}
          eventId={event.id}
          date={selectedDate}
          eventTitle={event.title}
          dateLabel={dateLabel}
        />

        <div className="no-print flex flex-wrap gap-2 mb-6">
          {days.map(day => (
            <Link
              key={day}
              href={`/admin/events/${event.id}/tischplan?date=${day}&mode=${mode}`}
              className={`px-4 py-2 rounded-full text-sm font-bold border ${day === selectedDate ? "bg-accent-green text-white border-accent-green" : "bg-white border-border-light text-base-dark hover:border-accent-green"}`}
            >
              {new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </Link>
          ))}
        </div>

        <section className="bg-white border border-border-light rounded-2xl p-4 sm:p-6 print:border-0 print:rounded-none print:p-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Image src="/Logo.png" alt="Maurer Events" width={162} height={48} className="h-8 w-auto object-contain" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-wood">Tischplan</p>
                <p className="font-display font-bold text-lg text-base-dark truncate">{event.title}</p>
                <p className="text-xs text-base-dark/60">{dateLabel} · {event.location}</p>
              </div>
            </div>
            <div className="text-right text-xs text-base-dark/60">
              <p className="font-bold uppercase tracking-wider">{mode === "public" ? "Öffentliche Version" : "Interne Version"}</p>
              <p>{reservedCount} belegte Tische · {tables.length} Tische gesamt</p>
              <p>Stand: {new Date().toLocaleString("de-DE")}</p>
            </div>
          </div>

          {tables.length === 0 ? (
            <div className="bg-canvas-light border border-border-light rounded-xl p-10 text-center text-base-dark/60">
              Noch kein Tischlayout vorhanden. Lege zuerst Tische im Event an.
            </div>
          ) : (
            <PlanSvg tables={tables} reservations={visibleReservations} tent={tent} mode={mode} />
          )}

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-bold text-base-dark/70">
            <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border border-accent-green bg-white" /> frei</span>
            <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-accent-green" /> reserviert</span>
            <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-accent-gold" /> VIP</span>
            <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-gray-400" /> gesperrt</span>
            {mode === "public" && <span className="text-base-dark/50">Namen sind in der öffentlichen Version ausgeblendet.</span>}
          </div>
        </section>
      </main>

      <style>{`
        @page { size: A3 landscape; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          nav, header, footer, .no-print { display: none !important; }
          .plan-page { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .plan-svg { max-height: 250mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}