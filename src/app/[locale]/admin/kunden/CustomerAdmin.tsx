"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import type { CustomerRecord } from "@/types/domain";
import { createCustomer } from "@/app/actions/customers";
import CustomerImport from "./CustomerImport";

const EMPTY = { displayName: "", company: "", email: "", phone: "", street: "", zip: "", city: "", notes: "" };

export default function CustomerAdmin({ initialCustomers }: { initialCustomers: CustomerRecord[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(customer => [customer.displayName, customer.company, customer.email, customer.phone]
      .filter(Boolean).some(value => value!.toLowerCase().includes(needle)));
  }, [customers, query]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await createCustomer(form);
      if (result.customer) setCustomers(current => [...current, result.customer].sort((a, b) => a.displayName.localeCompare(b.displayName, "de")));
      setForm(EMPTY);
      setShowCreate(false);
      setMessage("Kunde angelegt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Kunden</h1>
          <p className="text-base-dark/60 mt-1">{customers.length} Kunden im Stamm.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setShowImport(value => !value); setShowCreate(false); }} className="min-h-12 px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors">SnapTicket importieren</button>
          <button type="button" onClick={() => { setShowCreate(value => !value); setShowImport(false); }} className="min-h-12 px-5 bg-accent-green text-white rounded-xl font-bold hover:bg-base-dark transition-colors">+ Kunde</button>
        </div>
      </div>

      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
      {showImport && <CustomerImport onClose={() => setShowImport(false)} />}

      {showCreate && (
        <form onSubmit={create} className="bg-white border border-border-light rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-bold uppercase mb-1">Name *</label><input required value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Verein / Firma</label><input value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">E-Mail</label><input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Telefon</label><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Straße</label><input value={form.street} onChange={event => setForm({ ...form, street: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold uppercase mb-1">PLZ</label><input value={form.zip} onChange={event => setForm({ ...form, zip: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div><div><label className="block text-xs font-bold uppercase mb-1">Ort</label><input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div></div>
          <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase mb-1">Notizen</label><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3 min-h-[70px]" /></div>
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Kunde speichern"}</button></div>
        </form>
      )}

      <div className="bg-white border border-border-light rounded-2xl p-4">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen nach Name, Verein, E-Mail oder Telefon…" className="w-full bg-base-light border border-border-light rounded-xl p-3" />
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-base-dark/60">Keine Kunden gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-left">
                <tr><th className="px-4 py-3 font-bold">Name</th><th className="px-4 py-3 font-bold">Verein / Firma</th><th className="px-4 py-3 font-bold">E-Mail</th><th className="px-4 py-3 font-bold">Telefon</th><th className="px-4 py-3 font-bold">Ort</th><th className="px-4 py-3 font-bold"></th></tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr key={customer.id} className="border-t border-border-light">
                    <td className="px-4 py-3 font-bold">{customer.displayName}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.company || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.email || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.phone || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.city || "—"}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/kunden/${customer.id}`} className="font-bold text-accent-green hover:underline">Öffnen</Link></td>
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