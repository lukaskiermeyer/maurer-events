"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { Link } from "@/i18n/routing";
import type { CustomerRecord } from "@/types/domain";
import { getCustomers, exportCustomersCsv, createCustomer, findDuplicateCustomers, getDistinctCustomerTags, getCustomerStats } from "@/app/actions/customers";
import CustomerImport from "./CustomerImport";

const EMPTY = { displayName: "", company: "", email: "", phone: "", street: "", zip: "", city: "", notes: "", marketingConsent: false, tags: "" };

type Filters = {
  query: string;
  source: string;
  consent: "all" | "yes" | "no";
  hasEmail: "all" | "yes" | "no";
  hasPhone: "all" | "yes" | "no";
  tag: string;
  sort: "name" | "created" | "updated";
};

export default function CustomerAdmin({ initialCustomers, initialTotal }: { initialCustomers: CustomerRecord[]; initialTotal: number }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState<Filters>({ query: "", source: "all", consent: "all", hasEmail: "all", hasPhone: "all", tag: "all", sort: "name" });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(filters.query), 300);
    return () => clearTimeout(t);
  }, [filters.query]);

  useEffect(() => {
    getDistinctCustomerTags().then(setAvailableTags).catch(() => {});
    getCustomerStats().then(setStats).catch(() => {});
  }, []);

  const load = async (nextPage = page) => {
    startTransition(async () => {
      const result = await getCustomers({
        query: debouncedQuery,
        source: filters.source,
        consent: filters.consent,
        hasEmail: filters.hasEmail === "all" ? null : filters.hasEmail === "yes",
        hasPhone: filters.hasPhone === "all" ? null : filters.hasPhone === "yes",
        tag: filters.tag,
        sort: filters.sort,
        page: nextPage,
        pageSize,
      });
      setCustomers(result.rows as CustomerRecord[]);
      setTotal(result.total);
      setPage(result.page);
    });
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filters.source, filters.consent, filters.hasEmail, filters.hasPhone, filters.tag, filters.sort, pageSize]);

  const filteredCount = customers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setDuplicateWarning("");
    try {
      const dupes = await findDuplicateCustomers({ displayName: form.displayName, email: form.email, phone: form.phone });
      if (dupes.length > 0) {
        setDuplicateWarning(`Mögliche Dublette(n): ${dupes.map(d => d.displayName).join(", ")}. Trotzdem anlegen?`);
      }
      const result = await createCustomer({ ...form, marketingConsent: form.marketingConsent, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
      if (result.customer) {
        setCustomers(current => [result.customer as CustomerRecord, ...current]);
        setTotal(t => t + 1);
      }
      setForm(EMPTY);
      setShowCreate(false);
      setMessage("Kunde angelegt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const csv = await exportCustomersCsv({
      query: debouncedQuery,
      source: filters.source,
      consent: filters.consent,
      hasEmail: filters.hasEmail === "all" ? null : filters.hasEmail === "yes",
      hasPhone: filters.hasPhone === "all" ? null : filters.hasPhone === "yes",
      tag: filters.tag,
      sort: filters.sort,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kunden-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setFilter = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Kunden</h1>
          <p className="text-base-dark/60 mt-1">{total} Kunden im Stamm.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setShowImport(v => !v); setShowCreate(false); }} className="min-h-12 px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors">SnapTicket importieren</button>
          <button type="button" onClick={() => { setShowCreate(v => !v); setShowImport(false); }} className="min-h-12 px-5 bg-accent-green text-white rounded-xl font-bold hover:bg-base-dark transition-colors">+ Kunde</button>
          <button type="button" onClick={exportCsv} className="min-h-12 px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors">CSV exportieren</button>
        </div>
      </div>

      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
      {showImport && <CustomerImport onClose={() => setShowImport(false)} />}

      {showCreate && (
        <form onSubmit={create} className="bg-white border border-border-light rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-bold uppercase mb-1">Name *</label><input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Verein / Firma</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">E-Mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Telefon</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Straße</label><input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold uppercase mb-1">PLZ</label><input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div><div><label className="block text-xs font-bold uppercase mb-1">Ort</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div></div>
          <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase mb-1">Notizen</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3 min-h-[70px]" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase mb-1">Tags (kommagetrennt)</label><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" placeholder="z. B. Stammkunde, Verein, VIP" /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={form.marketingConsent} onChange={e => setForm({ ...form, marketingConsent: e.target.checked })} className="w-5 h-5 accent-accent-green" />
            Marketing-Einwilligung erteilt
          </label>
          {duplicateWarning && <p className="sm:col-span-2 text-sm font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-3">{duplicateWarning}</p>}
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Kunde speichern"}</button></div>
        </form>
      )}

      {stats.length > 0 && (
        <div className="bg-white border border-border-light rounded-2xl p-5">
          <h2 className="font-display font-bold text-xl mb-3">Top-Kunden nach Gästen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
            {stats.map((row, index) => (
              <div key={row.customer?.id || index} className="bg-base-light rounded-xl p-3">
                <div className="font-bold truncate">{row.customer?.displayName || "—"}</div>
                <div className="text-base-dark/60">{row.guests} Gäste · {row.bookings} Buchungen</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-border-light rounded-2xl p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
        <input value={filters.query} onChange={e => setFilter("query", e.target.value)} placeholder="Suchen nach Name, Verein, E-Mail, Telefon, Ort, Notizen…" className="md:col-span-2 bg-base-light border border-border-light rounded-xl p-3" />
        <select value={filters.source} onChange={e => setFilter("source", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="all">Alle Quellen</option>
          <option value="manual">Manuell</option>
          <option value="request">Anfrage</option>
          <option value="snapticket">SnapTicket</option>
        </select>
        <select value={filters.consent} onChange={e => setFilter("consent", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="all">Einwilligung: alle</option>
          <option value="yes">Mit Einwilligung</option>
          <option value="no">Ohne Einwilligung</option>
        </select>
        <select value={filters.hasEmail} onChange={e => setFilter("hasEmail", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="all">E-Mail: alle</option>
          <option value="yes">Mit E-Mail</option>
          <option value="no">Ohne E-Mail</option>
        </select>
        <select value={filters.hasPhone} onChange={e => setFilter("hasPhone", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="all">Telefon: alle</option>
          <option value="yes">Mit Telefon</option>
          <option value="no">Ohne Telefon</option>
        </select>
        <select value={filters.tag} onChange={e => setFilter("tag", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="all">Tag: alle</option>
          {availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select value={filters.sort} onChange={e => setFilter("sort", e.target.value)} className="bg-base-light border border-border-light rounded-xl p-3">
          <option value="name">Sortierung: Name</option>
          <option value="created">Sortierung: Neueste</option>
          <option value="updated">Sortierung: Aktualisiert</option>
        </select>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        {isPending ? (
          <p className="p-8 text-center text-base-dark/60">Lade…</p>
        ) : filteredCount === 0 ? (
          <p className="p-8 text-center text-base-dark/60">Keine Kunden gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-left">
                <tr><th className="px-4 py-3 font-bold">Name</th><th className="px-4 py-3 font-bold">Verein / Firma</th><th className="px-4 py-3 font-bold">E-Mail</th><th className="px-4 py-3 font-bold">Telefon</th><th className="px-4 py-3 font-bold">Ort</th><th className="px-4 py-3 font-bold">Tags</th><th className="px-4 py-3 font-bold">Quelle</th><th className="px-4 py-3 font-bold"></th></tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer.id} className="border-t border-border-light">
                    <td className="px-4 py-3 font-bold">{customer.displayName}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.company || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.email || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.phone || "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.city || "—"}</td>
                    <td className="px-4 py-3">{(customer.tags || []).length ? (customer.tags || []).map(t => <span key={t} className="inline-block bg-base-light border border-border-light rounded-full px-2 py-0.5 text-xs mr-1">{t}</span>) : "—"}</td>
                    <td className="px-4 py-3 text-base-dark/70">{customer.source}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/kunden/${customer.id}`} className="font-bold text-accent-green hover:underline">Öffnen</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-dark/60">Pro Seite:</span>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="bg-white border border-border-light rounded-lg p-2 text-sm">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(page - 1)} disabled={page <= 1 || isPending} className="min-h-10 px-4 bg-white border border-border-light rounded-lg font-bold disabled:opacity-50">Zurück</button>
          <span className="text-sm text-base-dark/60">Seite {page} von {totalPages}</span>
          <button type="button" onClick={() => load(page + 1)} disabled={page >= totalPages || isPending} className="min-h-10 px-4 bg-white border border-border-light rounded-lg font-bold disabled:opacity-50">Weiter</button>
        </div>
      </div>
    </div>
  );
}