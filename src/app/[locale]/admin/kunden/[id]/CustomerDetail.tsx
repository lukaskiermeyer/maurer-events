"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { CustomerRecord, EventRecord, TableRecord } from "@/types/domain";
import { updateCustomer, deleteCustomer, anonymizeCustomer, exportCustomerData } from "@/app/actions/customers";
import { assignTableToCustomer } from "@/app/actions/table-assignments";
import { getBookedTableIds } from "@/app/actions/tables";
import { useDialog } from "@/components/ui/Dialog";

type HistoryRow = {
  reservation: {
    id: string;
    reservationDate: Date | string;
    guestCount: number;
    status: string;
    selectedTime: string | null;
  };
  eventTitle: string | null;
  eventDate: Date | string | null;
  tableName: string | null;
};

export default function CustomerDetail({ customer, history, events, tables }: { customer: CustomerRecord; history: HistoryRow[]; events: EventRecord[]; tables: TableRecord[] }) {
  const [form, setForm] = useState({
    displayName: customer.displayName,
    company: customer.company || "",
    email: customer.email || "",
    phone: customer.phone || "",
    street: customer.street || "",
    zip: customer.zip || "",
    city: customer.city || "",
    notes: customer.notes || "",
    marketingConsent: customer.marketingConsent || false,
    tags: (customer.tags || []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const dialog = useDialog();

  const assignableEvents = useMemo(
    () => events.filter(event => event.type !== "gallery").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );
  const [assignEventId, setAssignEventId] = useState(assignableEvents[0]?.id || "");
  const [assignDate, setAssignDate] = useState("");
  const [assignTableId, setAssignTableId] = useState("");
  const [assignGuests, setAssignGuests] = useState("5");
  const [sendEmail, setSendEmail] = useState(true);
  const [booked, setBooked] = useState<string[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");

  const selectedEvent = assignableEvents.find(event => event.id === assignEventId);
  const eventDays = useMemo(() => {
    if (!selectedEvent) return [];
    if (Array.isArray(selectedEvent.reservableDates) && selectedEvent.reservableDates.length > 0) {
      return [...new Set(selectedEvent.reservableDates)].sort();
    }
    const start = new Date(selectedEvent.date);
    const end = selectedEvent.endDate ? new Date(selectedEvent.endDate) : start;
    const days: string[] = [];
    for (let day = new Date(start); day <= end && days.length < 60; day.setDate(day.getDate() + 1)) {
      days.push(day.toISOString().slice(0, 10));
    }
    return days.length ? days : [new Date(selectedEvent.date).toISOString().slice(0, 10)];
  }, [selectedEvent]);

  const effectiveAssignDate = eventDays.includes(assignDate) ? assignDate : (eventDays[0] || "");

  useEffect(() => {
    if (!assignEventId || !effectiveAssignDate) {
      const timer = setTimeout(() => setBooked([]), 0);
      return () => clearTimeout(timer);
    }
    let active = true;
    getBookedTableIds(assignEventId, effectiveAssignDate)
      .then(ids => { if (active) setBooked(ids.map(id => String(id))); })
      .catch(() => { if (active) setBooked([]); });
    return () => { active = false; };
  }, [assignEventId, effectiveAssignDate]);

  const totals = useMemo(() => {
    const guestCount = history.reduce((sum, row) => sum + (row.reservation.guestCount || 0), 0);
    const reservations = history.length;
    return { guestCount, reservations };
  }, [history]);

  const hasEmail = Boolean(customer.email?.trim());

  const exportData = async () => {
    const data = await exportCustomerData(customer.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kunde-${customer.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anonymize = async () => {
    if (!await dialog.confirm({ title: "Kunde anonymisieren", message: "Kundendaten wirklich anonymisieren und löschen? Reservierungen bleiben erhalten.", danger: true, confirmLabel: "Anonymisieren" })) return;
    setBusy(true);
    try {
      await anonymizeCustomer(customer.id);
      router.push("/admin/kunden");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    setAssignBusy(true);
    setAssignMessage("");
    try {
      const result = await assignTableToCustomer({
        customerId: customer.id,
        eventId: assignEventId,
        reservationDate: effectiveAssignDate,
        tableId: assignTableId,
        guestCount: Number(assignGuests),
        sendEmail,
      });
      setAssignMessage(
        result.warning
          ? `Tisch ${result.tableName} zugewiesen. ${result.warning}`
          : `Tisch ${result.tableName} zugewiesen${sendEmail ? " – Bestätigungsmail mit Ticket wurde versendet." : "."}`,
      );
      setAssignTableId("");
      router.refresh();
    } catch (error) {
      setAssignMessage(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.");
    } finally {
      setAssignBusy(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateCustomer(customer.id, { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
      setMessage("Kunde gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!await dialog.confirm({ title: "Kunde löschen", message: "Kunde wirklich löschen? Die Reservierungen bleiben erhalten.", danger: true, confirmLabel: "Löschen" })) return;
    setBusy(true);
    try {
      await deleteCustomer(customer.id);
      router.push("/admin/kunden");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/kunden" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline">&larr; Zurück zu Kunden</Link>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark mt-2">{customer.displayName}</h1>
          <p className="text-base-dark/60">{customer.company || customer.email || customer.phone || "Kunde"}</p>
        </div>
        <button type="button" onClick={remove} disabled={busy} className="min-h-11 px-4 rounded-xl border border-red-200 text-red-700 font-bold text-sm hover:bg-red-50 disabled:opacity-50">Kunde löschen</button>
      </div>

      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}

      <form onSubmit={save} className="bg-white border border-border-light rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-bold uppercase mb-1">Name *</label><input required value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Verein / Firma</label><input value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">E-Mail</label><input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Telefon</label><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Straße</label><input value={form.street} onChange={event => setForm({ ...form, street: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold uppercase mb-1">PLZ</label><input value={form.zip} onChange={event => setForm({ ...form, zip: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div><div><label className="block text-xs font-bold uppercase mb-1">Ort</label><input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div></div>
        <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase mb-1">Notizen</label><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3 min-h-[80px]" /></div>
        <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase mb-1">Tags (kommagetrennt)</label><input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" placeholder="z. B. Stammkunde, Verein, VIP" /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={form.marketingConsent} onChange={event => setForm({ ...form, marketingConsent: event.target.checked })} className="w-5 h-5 accent-accent-green" />
          Marketing-Einwilligung erteilt
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Änderungen speichern"}</button>
          <button type="button" onClick={exportData} className="px-6 py-3 rounded-xl border border-border-light font-bold hover:border-accent-green transition-colors">Daten exportieren (JSON)</button>
          <button type="button" onClick={anonymize} disabled={busy} className="px-6 py-3 rounded-xl border border-red-200 text-red-700 font-bold hover:bg-red-50 disabled:opacity-50">Anonymisieren & löschen</button>
        </div>
      </form>

      <details className="bg-white border border-border-light rounded-2xl shadow-sm group">
        <summary className="p-5 font-display font-bold text-xl cursor-pointer select-none list-none flex items-center gap-2 hover:text-accent-green">
          Tisch zuweisen
          <span aria-hidden className="ml-auto text-sm transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="px-5 pb-5 border-t border-border-light pt-4">
          {!hasEmail && (
            <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
              ⚠️ Für diesen Kunden ist keine E-Mail hinterlegt. Die automatische Tisch-Mail kann erst versendet werden, wenn oben eine E-Mail ergänzt und gespeichert wurde.
            </p>
          )}
          <form onSubmit={assign} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Event</label>
              <select required value={assignEventId} onChange={event => setAssignEventId(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3 disabled:opacity-50" disabled={!assignableEvents.length}>
                <option value="">Event wählen …</option>
                {assignableEvents.map(event => <option key={event.id} value={event.id}>{event.title} · {new Date(event.date).toLocaleDateString("de-DE")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Datum</label>
              <select required value={effectiveAssignDate} onChange={event => setAssignDate(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3 disabled:opacity-50" disabled={!eventDays.length}>
                {eventDays.map(day => <option key={day} value={day}>{new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Tisch</label>
              <select required value={assignTableId} onChange={event => setAssignTableId(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3">
                <option value="">Tisch wählen …</option>
                {tables.map(table => {
                  const occupied = booked.includes(table.id);
                  return <option key={table.id} value={table.id} disabled={occupied}>{table.displayNumber || table.name} ({table.capacity} Plätze){occupied ? " – belegt" : ""}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Personenanzahl</label>
              <input required type="number" min={1} max={100} value={assignGuests} onChange={event => setAssignGuests(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} className="w-5 h-5 accent-accent-green" />
              Bestätigungsmail mit Tisch automatisch an {customer.email || "Kunden"} senden (PDF-Ticket mit QR-Code)
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={assignBusy || !hasEmail || !assignEventId || !effectiveAssignDate || !assignTableId} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{assignBusy ? "Wird zugewiesen …" : "Tisch zuweisen"}</button>
              {assignMessage && <p className={`text-sm font-bold rounded-xl p-3 ${assignMessage.includes("zugewiesen") ? "bg-accent-green/10 text-accent-green" : "bg-red-50 text-red-700"}`}>{assignMessage}</p>}
            </div>
          </form>
        </div>
      </details>

      <div className="bg-white border border-border-light rounded-2xl p-5">
        <h2 className="font-display font-bold text-xl mb-3">Übersicht</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-base-light rounded-xl p-3"><div className="text-base-dark/60">Reservierungen</div><div className="font-bold text-lg">{totals.reservations}</div></div>
          <div className="bg-base-light rounded-xl p-3"><div className="text-base-dark/60">Gäste gesamt</div><div className="font-bold text-lg">{totals.guestCount}</div></div>
          <div className="bg-base-light rounded-xl p-3"><div className="text-base-dark/60">Marketing</div><div className="font-bold text-lg">{customer.marketingConsent ? "Ja" : "Nein"}</div></div>
        </div>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Reservierungen ({history.length})</h2>
        {history.length === 0 ? (
          <p className="p-6 text-base-dark/60">Noch keine Reservierungen mit diesem Kunden verknüpft.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-left">
                <tr><th className="px-4 py-3 font-bold">Event</th><th className="px-4 py-3 font-bold">Datum</th><th className="px-4 py-3 font-bold">Personen</th><th className="px-4 py-3 font-bold">Tisch</th><th className="px-4 py-3 font-bold">Status</th></tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.reservation.id} className="border-t border-border-light">
                    <td className="px-4 py-3 font-bold">{row.eventTitle || "—"}</td>
                    <td className="px-4 py-3">{new Date(row.reservation.reservationDate).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3">{row.reservation.guestCount}</td>
                    <td className="px-4 py-3">{row.tableName || "—"}</td>
                    <td className="px-4 py-3">{row.reservation.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}