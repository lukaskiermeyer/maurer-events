"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { PlanCanvas } from "@/components/admin/plan/PlanCanvas";
import { setEventPlan, assignPlanTable } from "@/app/actions/plans";
import { buildOccupancy, dayKey, findTable, tableLabel, INACTIVE_STATUSES } from "@/lib/plan-types";
import type { EventRecord, PlanPresetRecord, ReservationRow } from "@/types/domain";

export default function EventPlanPanel({ event, reservations, preset, presets }: {
  event: EventRecord;
  reservations: ReservationRow[];
  preset: PlanPresetRecord | null;
  presets: PlanPresetRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const days = useMemo(() => {
    if (event.reservableDates?.length) return [...new Set(event.reservableDates)].sort();
    return [dayKey(event.date)];
  }, [event.reservableDates, event.date]);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const layout = preset?.layout ?? null;
  const occupancy = useMemo(() => layout ? buildOccupancy(layout, reservations.map(r => r.reservation), selectedDate) : {}, [layout, reservations, selectedDate]);
  const unassigned = useMemo(() => reservations.filter(r =>
    !r.reservation.planTableId && !r.reservation.tableId
    && dayKey(r.reservation.reservationDate) === selectedDate
    && !INACTIVE_STATUSES.includes(r.reservation.status)
  ), [reservations, selectedDate]);
  const selectedTable = layout && selectedTableId ? findTable(layout, selectedTableId) : null;
  const selectedOcc = selectedTableId ? occupancy[selectedTableId] : undefined;

  const choosePreset = async (id: string) => {
    setBusy(true);
    try {
      await setEventPlan(event.id, id || null);
      setSelectedTableId(null);
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Preset-Auswahl fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  const assign = async (reservationId: string, tableId: string | null) => {
    setBusy(true);
    try {
      const result = await assignPlanTable(reservationId, tableId);
      if (result.warning) toast.showToast(result.warning, "warning");
      setSelectedResId(null);
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Zuweisung fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-subhead text-2xl">Tischplan & Zuweisung</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset?.id ?? ""}
            onChange={e => choosePreset(e.target.value)}
            disabled={busy}
            aria-label="Plan-Preset für dieses Event"
            className="min-h-12 rounded-xl border border-border-light bg-white px-3 font-bold disabled:opacity-50"
          >
            <option value="">Kein Plan gewählt</option>
            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Link href={`/admin/tischplaene${preset ? `?preset=${preset.id}` : ""}`} className="min-h-12 inline-flex items-center rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">
            Plan im Editor öffnen ↗
          </Link>
          {preset && (
            <Link href={`/admin/events/${event.id}/tischplan?mode=setup&dims=1`} className="min-h-12 inline-flex items-center rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">
              Aufbau-Plan fürs Team (A3, mit Maßen) ↗
            </Link>
          )}
        </div>
      </div>

      {!layout ? (
        <div className="rounded-2xl border border-border-light bg-canvas-light p-10 text-center">
          <p className="font-bold text-base-dark">Dieses Event hat noch keinen Tischplan.</p>
          <p className="mt-2 text-sm text-base-dark/60">Wähle oben ein Preset oder erstelle im Editor einen neuen Plan (Bereiche, Reihen, Tische, Bühne, Zeltgrenzen).</p>
          <Link href="/admin/tischplaene" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-accent-green px-6 font-bold text-white">Tischplan-Editor öffnen</Link>
        </div>
      ) : (
        <>
          {days.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map(day => (
                <button key={day} type="button" onClick={() => { setSelectedDate(day); setSelectedTableId(null); }} className={`whitespace-nowrap rounded-lg px-4 py-2 font-bold transition-colors ${selectedDate === day ? "bg-accent-green text-white" : "border border-border-light bg-canvas-light hover:border-accent-green"}`}>
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-4">
            <div className="flex max-h-72 flex-col rounded-xl border border-border-light bg-canvas-light p-4 xl:col-span-1 xl:h-[640px] xl:max-h-none">
              <h4 className="mb-4 font-subhead">Noch zuzuweisen ({unassigned.length})</h4>
              <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
                {unassigned.length === 0 && <p className="py-10 text-center text-sm opacity-50">Alle Gäste für diesen Tag sind zugewiesen!</p>}
                {unassigned.map(r => (
                  <div
                    key={r.reservation.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData("text/reservation", r.reservation.id)}
                    onClick={() => setSelectedResId(r.reservation.id === selectedResId ? null : r.reservation.id)}
                    className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-colors active:cursor-grabbing ${selectedResId === r.reservation.id ? "border-accent-green ring-2 ring-accent-green/50" : "border-border-light hover:border-accent-green"}`}
                  >
                    <div className="text-sm font-bold leading-tight">{r.reservation.guestName}</div>
                    <div className="mt-1 text-xs opacity-70">{r.reservation.guestCount} Personen · {r.reservation.status === "requested" ? "Anfrage" : r.reservation.status}</div>
                    {selectedResId === r.reservation.id && <div className="mt-2 inline-block rounded bg-accent-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-green">Ausgewählt: tippe auf einen Tisch</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 xl:col-span-3">
              <div className="h-[480px] overflow-hidden rounded-xl border border-border-light xl:h-[640px]">
                <PlanCanvas
                  layout={layout}
                  mode="view"
                  occupancy={occupancy}
                  onTableClick={id => setSelectedTableId(id === selectedTableId ? null : id)}
                  onTableDrop={(reservationId, tableId) => assign(reservationId, tableId)}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-base-dark/50">Scrollen = Zoom · Ziehen = Verschieben · Gast aus der Liste auf einen Tisch ziehen (oder Gast antippen, dann Tisch).</p>
            </div>
          </div>

          {selectedTable && (
            <div className="rounded-2xl border border-border-light bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-display text-lg font-bold">
                  {tableLabel(layout, selectedTable)}
                  {selectedTable.rowLabel ? ` · ${selectedTable.rowLabel}` : ""}
                  {selectedTable.vip ? " · VIP" : ""}
                  {selectedTable.blocked ? " · gesperrt" : ""}
                  <span className="ml-2 text-sm font-normal opacity-60">{selectedOcc?.guests ?? 0} / {selectedTable.capacity} Personen</span>
                </h4>
                <button type="button" onClick={() => setSelectedTableId(null)} className="text-sm font-bold opacity-60 hover:opacity-100">Schließen ×</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedOcc?.names ?? []).length === 0 && <p className="text-sm opacity-50">Noch keine Gäste an diesem Tisch.</p>}
                {reservations.filter(r => (r.reservation.planTableId ?? r.reservation.tableId) === selectedTable.id && dayKey(r.reservation.reservationDate) === selectedDate && !INACTIVE_STATUSES.includes(r.reservation.status)).map(r => (
                  <span key={r.reservation.id} className="inline-flex items-center gap-2 rounded-full bg-canvas-light px-3 py-1 text-sm font-bold">
                    {r.reservation.guestName} ({r.reservation.guestCount})
                    <button type="button" disabled={busy} onClick={() => assign(r.reservation.id, null)} aria-label={`Zuweisung von ${r.reservation.guestName} entfernen`} className="text-red-500 hover:text-red-700">×</button>
                  </span>
                ))}
              </div>
              {unassigned.length > 0 && !selectedTable.blocked && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select id="plan-assign-select" defaultValue="" className="min-h-11 rounded-xl border border-border-light bg-white px-3 text-sm font-bold" aria-label="Gast für diesen Tisch wählen">
                    <option value="" disabled>Gast wählen…</option>
                    {unassigned.map(r => <option key={r.reservation.id} value={r.reservation.id}>{r.reservation.guestName} ({r.reservation.guestCount} P.)</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const select = document.getElementById("plan-assign-select") as HTMLSelectElement;
                      if (select.value) assign(select.value, selectedTable.id);
                    }}
                    className="min-h-11 rounded-xl bg-accent-green px-5 font-bold text-white disabled:opacity-50"
                  >
                    An diesen Tisch zuweisen
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}