"use client";

import { useState } from "react";
import type { EventRecord, StaffAvailabilityRecord } from "@/types/domain";
import { deleteMyAvailability, saveMyAvailability } from "@/app/actions/staffing";

export default function AvailabilityForm({ events, initialAvailability }: { events: EventRecord[]; initialAvailability: StaffAvailabilityRecord[] }) {
  const [items, setItems] = useState(initialAvailability);
  const [form, setForm] = useState({
    eventId: events[0]?.id || "",
    date: events[0] ? new Date(events[0].date).toISOString().slice(0, 10) : "",
    startTime: "16:00",
    endTime: "23:00",
    kind: "available" as "available" | "unavailable" | "preferred",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const eventName = (id: string) => events.find(event => event.id === id)?.title || "Event";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const result = await saveMyAvailability(form.eventId, form);
      if (result.availability) setItems(current => [...current, result.availability]);
      setMessage("Verfügbarkeit gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteMyAvailability(id);
      setItems(current => current.filter(item => item.id !== id));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Verfügbarkeit</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Wann kannst du arbeiten?</h1>
        <p className="text-base-dark/60 mt-1">Trage deine Zeiten pro Fest ein. Der Festwirt sieht daraus, wer eingeplant werden kann.</p>
      </div>

      {events.length === 0 ? <p className="bg-white border border-border-light rounded-2xl p-6 text-base-dark/60">Aktuell sind keine kommenden Feste hinterlegt.</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={save} className="bg-white border border-border-light rounded-2xl p-5 space-y-3 h-fit">
            <h2 className="font-display font-bold text-xl">Zeit eintragen</h2>
            <select required value={form.eventId} onChange={event => {
              const eventId = event.target.value;
              const selected = events.find(item => item.id === eventId);
              setForm({ ...form, eventId, date: selected ? new Date(selected.date).toISOString().slice(0, 10) : form.date });
            }} className="w-full bg-base-light border border-border-light rounded-lg p-3">
              {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
            <input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
            <div className="grid grid-cols-2 gap-3"><input type="time" required value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /><input type="time" required value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
            <select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as "available" | "unavailable" | "preferred" })} className="w-full bg-base-light border border-border-light rounded-lg p-3">
              <option value="available">Verfügbar</option>
              <option value="preferred">Bevorzugt</option>
              <option value="unavailable">Nicht verfügbar</option>
            </select>
            <input placeholder="Notiz (optional)" value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
            <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Speichern</button>
            {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
          </form>

          <section className="lg:col-span-2 bg-white border border-border-light rounded-2xl p-5">
            <h2 className="font-display font-bold text-xl mb-3">Meine Zeiten ({items.length})</h2>
            {items.length === 0 ? <p className="text-sm text-base-dark/60">Noch keine Verfügbarkeit eingetragen.</p> : <div className="space-y-2">{items.map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border border-border-light rounded-xl p-3 text-sm">
                <div><p className="font-bold">{eventName(item.eventId)}</p><p className="text-base-dark/60">{new Date(item.date).toLocaleDateString("de-DE")} · {item.startTime}–{item.endTime} · {item.kind === "preferred" ? "bevorzugt" : item.kind === "unavailable" ? "nicht verfügbar" : "verfügbar"}</p></div>
                <button type="button" onClick={() => remove(item.id)} disabled={busy} className="text-red-600 font-bold">Löschen</button>
              </div>
            ))}</div>}
          </section>
        </div>
      )}
    </div>
  );
}