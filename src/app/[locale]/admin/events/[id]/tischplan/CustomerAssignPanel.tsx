"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/routing";
import type { CustomerRecord, TableRecord } from "@/types/domain";
import { assignTableToCustomer } from "@/app/actions/table-assignments";

export default function CustomerAssignPanel({
  customers,
  tables,
  bookedTableIds,
  eventId,
  date,
  eventTitle,
  dateLabel,
}: {
  customers: CustomerRecord[];
  tables: TableRecord[];
  bookedTableIds: string[];
  eventId: string;
  date: string;
  eventTitle: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedCustomer = customers.find(customer => customer.id === customerId);
  const booked = useMemo(() => new Set(bookedTableIds.map(String)), [bookedTableIds]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? customers.filter(customer =>
          [customer.displayName, customer.company, customer.email, customer.phone]
            .filter(Boolean)
            .some(value => value!.toLowerCase().includes(needle)),
        )
      : customers;
    return pool.slice(0, 8);
  }, [customers, query]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await assignTableToCustomer({
        customerId,
        eventId,
        reservationDate: date,
        tableId,
        guestCount: Number(guestCount),
        sendEmail,
      });
      setMessage({
        ok: true,
        text: result.warning
          ? `Tisch ${result.tableName} fest zugewiesen. ${result.warning}`
          : `Tisch ${result.tableName} fest zugewiesen${sendEmail ? " – Bestätigungsmail wurde versendet." : "."}`,
      });
      setTableId("");
      setGuestCount("");
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Zuweisung fehlgeschlagen." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="no-print bg-white border border-border-light rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-xl">Kunde am Tisch fest zuweisen</h2>
          <p className="text-xs text-base-dark/60 mt-0.5">{eventTitle} · {dateLabel} · Die Bestätigungsmail mit Ticket wird automatisch versendet.</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Kunde suchen: Name, Verein, E-Mail oder Telefon …"
          className="w-full bg-base-light border border-border-light rounded-xl p-3"
        />
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-border-light rounded-xl border border-border-light overflow-hidden bg-white">
            {results.map(customer => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => { setCustomerId(customer.id); setQuery(""); }}
                  aria-pressed={customerId === customer.id}
                  className={`w-full text-left px-4 py-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-canvas-light ${customerId === customer.id ? "bg-accent-green/10" : ""}`}
                >
                  <span className="font-bold">{customer.displayName}</span>
                  {customer.company && <span className="text-base-dark/60">{customer.company}</span>}
                  <span className="text-xs text-base-dark/50">{customer.email || "keine E-Mail"}</span>
                  {customerId === customer.id && <span className="ml-auto text-xs font-black text-accent-green">✓ ausgewählt</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Tisch</label>
          <select required value={tableId} onChange={event => setTableId(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3">
            <option value="">Tisch wählen …</option>
            {tables.map(table => {
              const occupied = booked.has(table.id);
              return <option key={table.id} value={table.id} disabled={occupied}>{table.displayNumber || table.name} ({table.capacity} Plätze){occupied ? " – belegt" : ""}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Personenanzahl</label>
          <input required type="number" min={1} max={100} placeholder="z. B. 6" value={guestCount} onChange={event => setGuestCount(event.target.value)} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer sm:pb-2">
          <input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} className="w-5 h-5 accent-accent-green" />
          Mail mit Tisch senden
        </label>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || !selectedCustomer || !tableId || !guestCount}
            className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-accent-green/90"
          >
            {busy ? "Wird fest zugewiesen …" : "📌 Tisch fest zuweisen"}
          </button>
          {selectedCustomer && (
            <p className="text-sm text-base-dark/60">
              Kunde: <span className="font-bold text-base-dark">{selectedCustomer.displayName}</span>
              {!selectedCustomer.email && <span className="ml-2 font-bold text-amber-700">⚠️ keine E-Mail im Kundenprofil – Mailversand nicht möglich</span>}
            </p>
          )}
          {message && (
            <p className={`text-sm font-bold rounded-xl p-3 ${message.ok ? "bg-accent-green/10 text-accent-green" : "bg-red-50 text-red-700"}`}>{message.text}</p>
          )}
        </div>
      </form>
    </section>
  );
}
