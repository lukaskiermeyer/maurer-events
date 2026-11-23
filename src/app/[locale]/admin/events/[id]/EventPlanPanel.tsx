"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";
import { PlanCanvas } from "@/components/admin/plan/PlanCanvas";
import { setEventPlan, assignPlanTable } from "@/app/actions/plans";
import { getCustomers } from "@/app/actions/customers";
import { createReservationForCustomer, finalizeReservation, reissueTicket, sendConfirmationMail } from "@/app/actions/reservations";
import { buildOccupancy, dayKey, findTable, tableLabel, INACTIVE_STATUSES } from "@/lib/plan-types";
import type { CustomerRecord, EventRecord, PlanPresetRecord, ReservationRow } from "@/types/domain";

export default function EventPlanPanel({ event, reservations, preset, presets }: {
  event: EventRecord;
  reservations: ReservationRow[];
  preset: PlanPresetRecord | null;
  presets: PlanPresetRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const days = useMemo(() => {
    if (event.reservableDates?.length) return [...new Set(event.reservableDates)].sort();
    return [dayKey(event.date)];
  }, [event.reservableDates, event.date]);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sideTab, setSideTab] = useState<"res" | "customers">("res");
  const [showDims, setShowDims] = useState(false);
  const [resQuery, setResQuery] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [custQuery, setCustQuery] = useState("");
  const [custTag, setCustTag] = useState("all");
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const layout = preset?.layout ?? null;
  const occupancy = useMemo(() => layout ? buildOccupancy(layout, reservations.map(r => r.reservation), selectedDate) : {}, [layout, reservations, selectedDate]);
  const unassigned = useMemo(() => {
    const q = resQuery.trim().toLowerCase();
    return reservations.filter(r =>
      !r.reservation.planTableId && !r.reservation.tableId
      && dayKey(r.reservation.reservationDate) === selectedDate
      && !INACTIVE_STATUSES.includes(r.reservation.status)
      && (!q || r.reservation.guestName.toLowerCase().includes(q) || r.reservation.email.toLowerCase().includes(q)));
  }, [reservations, selectedDate, resQuery]);
  const dayGuests = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of days) map[d] = reservations
      .filter(r => dayKey(r.reservation.reservationDate) === d && !INACTIVE_STATUSES.includes(r.reservation.status))
      .reduce((s, r) => s + r.reservation.guestCount, 0);
    return map;
  }, [reservations, days]);
  const mailTodos = useMemo(() => reservations.filter(r =>
    r.reservation.status === "confirmed" && !r.reservation.ticketSentAt
    && dayKey(r.reservation.reservationDate) === selectedDate
  ), [reservations, selectedDate]);
  const selectedTable = layout && selectedTableId ? findTable(layout, selectedTableId) : null;
  const selectedOcc = selectedTableId ? occupancy[selectedTableId] : undefined;
  const tags = useMemo(() => [...new Set(customers.flatMap(c => c.tags ?? []))].sort(), [customers]);

  useEffect(() => {
    if (sideTab !== "customers") return;
    let alive = true;
    setCustLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await getCustomers({ query: custQuery, tag: custTag, hasEmail: true, pageSize: 100 });
        if (alive) setCustomers(res.rows);
      } catch { if (alive) setCustomers([]); }
      finally { if (alive) setCustLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [sideTab, custQuery, custTag]);

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

  const assignCustomer = async (customerId: string, tableId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    const countRaw = await dialog.prompt({
      title: "Reservierung anlegen",
      message: `Wie viele Personen für ${customer.displayName}?`,
      inputLabel: "Personen",
      initialValue: "8",
      confirmLabel: "Anlegen & zuweisen",
    });
    if (countRaw === null) return;
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 1) { toast.showToast("Bitte eine gültige Personenzahl eingeben.", "warning"); return; }
    setBusy(true);
    try {
      await createReservationForCustomer({ eventId: event.id, customerId, guestCount: count, reservationDate: selectedDate, planTableId: tableId });
      toast.showToast(`${customer.displayName} angelegt und zugewiesen. Zum Festschreiben Tisch öffnen.`);
      setSelectedCustomerId(null);
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  const finalize = async (reservationId: string, sendEmail: boolean) => {
    setBusy(true);
    try {
      const res = await finalizeReservation(reservationId, sendEmail);
      if (res.warning) toast.showToast(res.warning, "warning");
      else if (res.mailSent) toast.showToast("Festgeschrieben und Bestätigungs-Mail versendet.", "success");
      else toast.showToast("Festgeschrieben – Mail noch nicht versendet (ToDo).", "warning");
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Festschreiben fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  const sendMail = async (reservationId: string) => {
    setBusy(true);
    try {
      const res = await sendConfirmationMail(reservationId);
      if (res.warning) toast.showToast(res.warning, "warning");
      else toast.showToast("Bestätigungs-Mail versendet.", "success");
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Mailversand fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  const reissue = async (reservationId: string) => {
    setBusy(true);
    try {
      const res = await reissueTicket(reservationId);
      if (res.warning) toast.showToast(res.warning, "warning");
      else toast.showToast("Ticket neu erzeugt und Mail erneut versendet.", "success");
      router.refresh();
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Neuversand fehlgeschlagen.", "error"); }
    finally { setBusy(false); }
  };

  const tableReservations = selectedTable
    ? reservations.filter(r => (r.reservation.planTableId ?? r.reservation.tableId) === selectedTable.id && dayKey(r.reservation.reservationDate) === selectedDate && !INACTIVE_STATUSES.includes(r.reservation.status))
    : [];

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
          <Link href={`/admin/events/${event.id}/tischplan`} className="min-h-12 inline-flex items-center rounded-xl bg-base-dark px-4 font-bold text-white hover:bg-accent-green">
            Tischplan drucken (A3)
          </Link>
          {preset && (
            <button type="button" onClick={() => setShowDims(v => !v)} aria-pressed={showDims} className="min-h-12 inline-flex items-center rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">
              {showDims ? "Maße ausblenden" : "Maße einblenden"}
            </button>
          )}
          {preset && (
            <Link href={`/admin/events/${event.id}/tischplan?mode=setup&dims=1`} className="min-h-12 inline-flex items-center rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">
              Aufbau-Plan fürs Team (A3, mit Maßen) ↗
            </Link>
          )}
        </div>
      </div>

      {mailTodos.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-800">⚠ {mailTodos.length} festgeschriebene Reservierung(en) ohne Bestätigungs-Mail – bitte nachholen:</p>
            <button
              type="button"
              disabled={mailBusy}
              onClick={async () => {
                setMailBusy(true);
                let sent = 0;
                for (const r of mailTodos) {
                  try { const res = await sendConfirmationMail(r.reservation.id); if (res.mailSent) sent++; } catch { /* nächste Mail versuchen */ }
                }
                setMailBusy(false);
                toast.showToast(`${sent} von ${mailTodos.length} Mails versendet.`, sent === mailTodos.length ? "success" : "warning");
                router.refresh();
              }}
              className="min-h-11 rounded-xl bg-accent-green px-4 text-sm font-bold text-white hover:bg-base-dark disabled:opacity-50"
            >
              {mailBusy ? "Sendet…" : "Alle offenen Mails senden"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {mailTodos.map(r => (
              <span key={r.reservation.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800">
                {r.reservation.guestName} ({r.reservation.guestCount} P.)
                <button type="button" disabled={busy} onClick={() => sendMail(r.reservation.id)} className="rounded-full bg-accent-green px-2 py-0.5 text-white hover:bg-base-dark">Mail senden</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!layout ? (
        <div className="rounded-2xl border border-border-light bg-canvas-light p-10 text-center">
          <p className="font-bold text-base-dark">Dieses Event hat noch keinen Tischplan.</p>
          <p className="mt-2 text-sm text-base-dark/60">Wähle oben ein Preset oder erstelle im Editor einen neuen Plan (Bereiche, Reihen, Tische, Bühne, Zeltgrenzen).</p>
          <Link href="/admin/tischplaene" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-accent-green px-6 font-bold text-white">Tischplan-Editor öffnen</Link>
        </div>
      ) : (
        <>
          {days.length >= 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map(day => (
                <button key={day} type="button" onClick={() => { setSelectedDate(day); setSelectedTableId(null); }} className={`whitespace-nowrap rounded-lg px-4 py-2 font-bold transition-colors ${selectedDate === day ? "bg-accent-green text-white" : "border border-border-light bg-canvas-light hover:border-accent-green"}`}>
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}
                  <span className="ml-1 text-xs opacity-70">· {dayGuests[day] ?? 0} Gäste</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-4">
            <div className="flex max-h-96 flex-col rounded-xl border border-border-light bg-canvas-light p-4 xl:col-span-1 xl:h-[640px] xl:max-h-none">
              <div className="mb-3 flex rounded-lg border border-border-light bg-white p-1" role="tablist" aria-label="Zuweisungsquelle">
                <button type="button" role="tab" aria-selected={sideTab === "res"} onClick={() => setSideTab("res")} className={`min-h-9 flex-1 rounded-md px-2 text-xs font-bold ${sideTab === "res" ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}>
                  Reservierungen ({unassigned.length})
                </button>
                <button type="button" role="tab" aria-selected={sideTab === "customers"} onClick={() => setSideTab("customers")} className={`min-h-9 flex-1 rounded-md px-2 text-xs font-bold ${sideTab === "customers" ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}>
                  Kunden
                </button>
              </div>

              {sideTab === "res" ? (
                <>
                <input
                  value={resQuery}
                  onChange={e => setResQuery(e.target.value)}
                  placeholder="Suche: Name oder E-Mail…"
                  aria-label="Reservierungen durchsuchen"
                  className="mb-2 min-h-10 w-full rounded-lg border border-border-light bg-white px-3 text-sm focus:outline-none focus:border-accent-green"
                />
                <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
                  {unassigned.length === 0 && <p className="py-10 text-center text-sm opacity-50">{resQuery ? "Keine Treffer für diese Suche." : "Alle Gäste für diesen Tag sind zugewiesen!"}</p>}
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
                </>
              ) : (
                <>
                  <input
                    value={custQuery}
                    onChange={e => setCustQuery(e.target.value)}
                    placeholder="Suche: Name, Firma, E-Mail, Ort…"
                    aria-label="Kunden durchsuchen"
                    className="mb-2 min-h-10 w-full rounded-lg border border-border-light bg-white px-3 text-sm focus:outline-none focus:border-accent-green"
                  />
                  <select value={custTag} onChange={e => setCustTag(e.target.value)} aria-label="Kunden nach Tag filtern" className="mb-3 min-h-10 w-full rounded-lg border border-border-light bg-white px-2 text-xs font-bold">
                    <option value="all">Alle Tags</option>
                    {tags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
                    {custLoading && <p className="py-6 text-center text-sm opacity-50">Lädt…</p>}
                    {!custLoading && customers.length === 0 && <p className="py-6 text-center text-sm opacity-50">Keine Kunden mit E-Mail gefunden.</p>}
                    {!custLoading && customers.map(c => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData("text/customer", c.id)}
                        onClick={() => setSelectedCustomerId(c.id === selectedCustomerId ? null : c.id)}
                        className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-colors active:cursor-grabbing ${selectedCustomerId === c.id ? "border-accent-green ring-2 ring-accent-green/50" : "border-border-light hover:border-accent-green"}`}
                      >
                        <div className="text-sm font-bold leading-tight">{c.displayName}</div>
                        <div className="mt-1 truncate text-xs opacity-70">{c.company ? `${c.company} · ` : ""}{c.email}</div>
                        {selectedCustomerId === c.id && <div className="mt-2 inline-block rounded bg-accent-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-green">Ausgewählt: tippe auf einen Tisch</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="min-w-0 xl:col-span-3">
              <div className="h-[480px] overflow-hidden rounded-xl border border-border-light xl:h-[640px]">
                <PlanCanvas
                  layout={layout}
                  mode="view"
                  occupancy={occupancy}
                  showDims={showDims}
                  measurements={showDims ? (layout.measurements ?? []).filter(m => m.print !== false) : []}
                  onTableClick={id => {
                    if (selectedCustomerId) { assignCustomer(selectedCustomerId, id); return; }
                    setSelectedTableId(id === selectedTableId ? null : id);
                  }}
                  onTableDrop={(payload, tableId) => {
                    if (payload.startsWith("customer:")) assignCustomer(payload.slice(9), tableId);
                    else assign(payload, tableId);
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-base-dark/50">Scrollen = Zoom · Ziehen = Verschieben · Gast oder Kunde aus der Liste auf einen Tisch ziehen (oder antippen, dann Tisch). Kunden legen eine neue Reservierung an.</p>
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
                  <span className={`ml-2 text-sm font-normal ${selectedOcc && selectedOcc.guests > selectedTable.capacity ? "font-bold text-red-600" : "opacity-60"}`}>
                    {selectedOcc?.guests ?? 0} / {selectedTable.capacity} Personen{selectedOcc && selectedOcc.guests > selectedTable.capacity ? " – überbucht!" : ""}
                  </span>
                </h4>
                <button type="button" onClick={() => setSelectedTableId(null)} className="text-sm font-bold opacity-60 hover:opacity-100">Schließen ×</button>
              </div>
              <div className="mt-3 space-y-2">
                {tableReservations.length === 0 && <p className="text-sm opacity-50">Noch keine Gäste an diesem Tisch.</p>}
                {tableReservations.map(r => (
                  <div
                    key={r.reservation.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData("text/reservation", r.reservation.id)}
                    title="Auf einen anderen Tisch ziehen, um umzubuchen"
                    className="flex cursor-grab flex-wrap items-center gap-2 rounded-xl bg-canvas-light px-3 py-2 text-sm font-bold active:cursor-grabbing"
                  >
                    <span>{r.reservation.guestName} ({r.reservation.guestCount} P.)</span>
                    <span className="text-xs opacity-60">{r.reservation.status}</span>
                    {r.reservation.status === "confirmed" && r.reservation.ticketSentAt && <span className="text-xs text-accent-green" title="Bestätigungs-Mail versendet">✓ Mail</span>}
                    {r.reservation.status === "confirmed" && !r.reservation.ticketSentAt && <span className="text-xs text-amber-700" title="Bestätigungs-Mail fehlt">⚠ Mail fehlt</span>}
                    <span className="ml-auto flex flex-wrap gap-2">
                      {r.reservation.status !== "confirmed" && (
                        <>
                          <button type="button" disabled={busy} onClick={() => finalize(r.reservation.id, true)} className="rounded-lg bg-accent-green px-3 py-1 text-xs text-white hover:bg-base-dark">Festschreiben + Mail</button>
                          <button type="button" disabled={busy} onClick={() => finalize(r.reservation.id, false)} className="rounded-lg border border-border-light bg-white px-3 py-1 text-xs hover:border-amber-400">Nur festschreiben</button>
                        </>
                      )}
                      {r.reservation.status === "confirmed" && !r.reservation.ticketSentAt && (
                        <button type="button" disabled={busy} onClick={() => sendMail(r.reservation.id)} className="rounded-lg bg-accent-green px-3 py-1 text-xs text-white hover:bg-base-dark">Mail senden</button>
                      )}
                      {r.reservation.status === "confirmed" && r.reservation.ticketSentAt && (
                        <button type="button" disabled={busy} onClick={() => reissue(r.reservation.id)} title="Ticket-PDF mit aktuellem Tisch neu erzeugen und Mail erneut senden" className="rounded-lg border border-border-light bg-white px-3 py-1 text-xs hover:border-accent-green">Mail neu senden</button>
                      )}
                      <button type="button" disabled={busy} onClick={() => assign(r.reservation.id, null)} aria-label={`Zuweisung von ${r.reservation.guestName} entfernen`} className="rounded-lg border border-border-light bg-white px-2 py-1 text-xs text-red-500 hover:border-red-400">×</button>
                    </span>
                  </div>
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