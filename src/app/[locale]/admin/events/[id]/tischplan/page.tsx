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
import { getEventPlan } from "@/app/actions/plans";
import { buildOccupancy, planTables, tableLabel } from "@/lib/plan-types";
import { PlanStaticSvg } from "@/components/admin/plan/PlanCanvas";
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
  searchParams: Promise<{ date?: string; mode?: string; dims?: string }>;
}) {
  await requireAdmin(true);
  const { id } = await params;
  const query = await searchParams;
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event || event.deletedAt) notFound();

  const [tables, reservations, tent, preset] = await Promise.all([
    getTables(),
    getReservationsByEvent(id),
    getTentSettings(),
    getEventPlan(id),
  ]);

  const days = eventDays(event);
  const selectedDate = query.date && days.includes(query.date) ? query.date : days[0];
  const mode = query.mode === "public" ? "public" : query.mode === "setup" ? "setup" : "internal";
  const dimsOn = query.dims ? query.dims === "1" : mode === "setup";
  const planLayout = preset?.layout ?? null;
  const occupancy = planLayout ? buildOccupancy(planLayout, reservations.map(r => r.reservation), selectedDate) : null;
  const visibleReservations = reservations.filter(row => {
    const reservation = row.reservation;
    return (reservation.planTableId ?? reservation.tableId)
      && ["paid", "confirmed", "checked_in"].includes(reservation.status)
      && new Date(reservation.reservationDate).toISOString().slice(0, 10) === selectedDate;
  });
  const totalTables = planLayout ? planTables(planLayout).length : tables.length;
  const reservedCount = occupancy ? Object.values(occupancy).filter(o => o.kind === "reserved").length : visibleReservations.length;
  // Belegungsliste neben dem Plan statt Namen unter den Tischen (keine Überlappung)
  const occupancyEntries = planLayout && occupancy
    ? planTables(planLayout).flatMap(t => {
      const occ = occupancy[t.id];
      return occ && occ.kind === "reserved" ? [{ label: tableLabel(planLayout, t), occ }] : [];
    })
    : [];
  const dateLabel = new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const [customers, bookedTableIds] = await Promise.all([
    getCustomers().then(r => r.rows),
    getBookedTableIds(id, selectedDate).catch(() => [] as string[]),
  ]);

  return (
    <div className="plan-page-wrap min-h-screen bg-base-light pb-10">
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
            {(["internal", "public", "setup"] as const).map(m => (
              <Link
                key={m}
                href={`/admin/events/${event.id}/tischplan?date=${selectedDate}&mode=${m}${dimsOn ? "&dims=1" : ""}`}
                className={`min-h-12 inline-flex items-center px-5 border rounded-xl font-bold transition-colors ${mode === m ? "bg-accent-green text-white border-accent-green" : "bg-white border-border-light hover:border-accent-green"}`}
              >
                {m === "internal" ? "Intern (Belegung)" : m === "public" ? "Öffentlich" : "Aufbau-Plan (Maße)"}
              </Link>
            ))}
            <Link
              href={`/admin/events/${event.id}/tischplan?date=${selectedDate}&mode=${mode}&dims=${dimsOn ? "0" : "1"}`}
              className="min-h-12 inline-flex items-center px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors"
            >
              {dimsOn ? "Maße ausblenden" : "Maße einblenden"}
            </Link>
          </div>
        </div>

        {planLayout ? (
          <div className="no-print mb-6 rounded-xl border border-border-light bg-white p-4 text-sm font-bold text-base-dark/70">
            Gäste werden im Event unter „Tisch & Zelt“ direkt auf dem zoombaren Plan zugewiesen.{" "}
            <Link href={`/admin/events/${event.id}`} className="text-accent-green underline">Zum Event →</Link>
          </div>
        ) : (
          <CustomerAssignPanel
            customers={customers}
            tables={tables}
            bookedTableIds={(bookedTableIds as string[]).map(String)}
            eventId={event.id}
            date={selectedDate}
            eventTitle={event.title}
            dateLabel={dateLabel}
          />
        )}

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

        <section className="plan-sheet bg-white border border-border-light rounded-2xl p-4 sm:p-6 print:border-0 print:rounded-none print:p-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Image src="/LogoFinalGrün_MaurerEvents.svg" alt="Maurer Events" width={162} height={76} className="h-8 w-auto object-contain" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-wood">Tischplan</p>
                <p className="font-display font-bold text-lg text-base-dark truncate">{event.title}</p>
                <p className="text-xs text-base-dark/60">{dateLabel} · {event.location}</p>
              </div>
            </div>
            <div className="text-right text-xs text-base-dark/60">
              <p className="font-bold uppercase tracking-wider">{mode === "public" ? "Öffentliche Version" : mode === "setup" ? "Aufbau-Plan fürs Team" : "Interne Version"}</p>
              {mode === "setup" && planLayout ? (
                <p>{totalTables} Tische · {planTables(planLayout).reduce((s, t) => s + t.capacity, 0)} Plätze · Zelt {Math.round(planLayout.widthCm / 100)} × {Math.round(planLayout.heightCm / 100)} m</p>
              ) : (
                <p>{reservedCount} belegte Tische · {totalTables} Tische gesamt</p>
              )}
              <p>Stand: {new Date().toLocaleString("de-DE")}</p>
            </div>
          </div>

          {planLayout ? (
            planTables(planLayout).length === 0 ? (
              <div className="bg-canvas-light border border-border-light rounded-xl p-10 text-center text-base-dark/60">
                Das gewählte Preset enthält noch keine Tische. Bitte im Tischplan-Editor ergänzen.
              </div>
            ) : (
              <div className="plan-row flex flex-col gap-4 items-start lg:flex-row">
                <PlanStaticSvg layout={planLayout} occupancy={mode === "setup" ? undefined : occupancy ?? undefined} showDims={dimsOn} neutral={mode === "setup"} className="plan-svg w-full h-auto min-w-0 flex-1" />
                {mode === "internal" && (
                  <aside className="plan-occupancy w-full shrink-0 rounded-xl border border-border-light bg-canvas-light p-3 text-xs lg:w-72">
                    <p className="mb-2 font-bold uppercase tracking-widest opacity-60">Belegung</p>
                    {occupancyEntries.length === 0 ? (
                      <p className="opacity-60">Noch keine belegten Tische an diesem Tag.</p>
                    ) : (
                      <ul className="space-y-1">
                        {occupancyEntries.map(e => (
                          <li key={e.label} className="break-inside-avoid">
                            <span className="font-bold">{e.label}</span> · {e.occ.names?.join(", ")} ({e.occ.guests} P.)
                          </li>
                        ))}
                      </ul>
                    )}
                  </aside>
                )}
              </div>
            )
          ) : tables.length === 0 ? (
            <div className="bg-canvas-light border border-border-light rounded-xl p-10 text-center text-base-dark/60">
              Noch kein Tischlayout vorhanden. Lege zuerst Tische im Event an.
            </div>
          ) : (
            <PlanSvg tables={tables} reservations={visibleReservations} tent={tent} mode={mode === "public" ? "public" : "internal"} />
          )}

          {mode === "setup" ? (
            <div className="mt-4 space-y-3 text-xs font-bold text-base-dark/70">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border-2 border-accent-green bg-white" /> Garnitur (Tisch + Bänke)</span>
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border border-dashed border-base-dark/50 bg-base-dark/5" /> Reihe</span>
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-[#D9D9D9]" /> Bereich</span>
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-[#4B5563]" /> Wand</span>
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border-2 border-accent-green bg-[#F4F0E8]" /> Tür / Öffnung</span>
                <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-[#8B4A2B]" /> Bühne</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <svg viewBox="0 0 500 40" className="h-6 w-40" aria-label="Maßstab 5 Meter">
                  <line x1={0} y1={20} x2={500} y2={20} stroke="#1A1A1A" strokeWidth={6} />
                  <line x1={0} y1={5} x2={0} y2={35} stroke="#1A1A1A" strokeWidth={6} />
                  <line x1={250} y1={10} x2={250} y2={30} stroke="#1A1A1A" strokeWidth={4} />
                  <line x1={500} y1={5} x2={500} y2={35} stroke="#1A1A1A" strokeWidth={6} />
                </svg>
                <span>= 5 m · Alle Maße in cm, Abstände = lichte Weite zwischen Garnituren bzw. Wandkanten</span>
              </div>
              <p className="text-base-dark/50">Reihen-Labels = Aufbau-Reihenfolge ab Zeltkante; Türen mit Breite und Abstand ab Ecke bemaßt. Preset: {preset?.name ?? "–"}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-bold text-base-dark/70">
              <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border border-accent-green bg-white" /> frei</span>
              <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-accent-green" /> reserviert</span>
              <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-accent-gold" /> VIP</span>
              <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-gray-400" /> gesperrt</span>
              {mode === "public" && <span className="text-base-dark/50">Namen sind in der öffentlichen Version ausgeblendet.</span>}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @page { size: A3 landscape; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; }
          /* Layout-Main darf im Druck nicht auf Viewport-Höhe stretchen (leere 2. Seite) */
          main { flex-grow: 0 !important; min-height: 0 !important; height: auto !important; }
          nav, header, footer, .no-print { display: none !important; }
          .plan-page-wrap { min-height: 0 !important; padding: 0 !important; }
          .plan-page { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          /* Genau eine A3-Seite: Plan bekommt eine feste Max-Höhe in mm statt
             Flex-Shrinking (Chrome-Druck shränkt Flex-SVGs nicht zuverlässig). */
          .plan-sheet { break-inside: avoid; page-break-inside: avoid; }
          .plan-row { display: flex; flex-direction: row; gap: 4mm; align-items: flex-start; }
          .plan-row .plan-svg { flex: 1 1 auto; min-width: 0; width: auto; height: auto; max-height: 234mm !important; }
          .plan-occupancy { width: 78mm; max-height: 234mm; overflow: hidden; columns: 2; column-gap: 4mm; font-size: 7.5pt; border: 0; background: none; padding: 0; border-radius: 0; }
          .plan-occupancy ul { margin: 0; padding: 0; list-style: none; }
          .plan-occupancy li { margin: 0 0 1.5mm; break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}