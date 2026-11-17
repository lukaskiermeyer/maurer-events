"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPayrollExport } from "@/app/actions/payroll";

type StatusRow = {
  id: string;
  name: string;
  role: string;
  roleId: string | null;
  status: string;
  employmentType: string;
  missing: string[];
  assignedEventIds: string[];
};

type EventOption = { id: string; title: string; date: Date | string };

const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob",
  short_term: "Kurzfristig",
  student: "Werkstudent",
  employed: "Angestellt",
};

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Profil offen",
  ready: "Bereit",
  active: "Aktiv",
};

export default function PayrollExportClient({ rows, events }: { rows: StatusRow[]; events: EventOption[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ url: string; rowCount: number; expiresAt: string } | null>(null);
  const [missing, setMissing] = useState<Array<{ name: string; fields: string[] }>>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [completeness, setCompleteness] = useState("all");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map(row => row.id)));
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  const roles = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.roleId) map.set(row.roleId, row.role);
    }
    return Array.from(map.entries());
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      if (query && !row.name.toLowerCase().includes(query)) return false;
      if (eventId !== "all" && !row.assignedEventIds.includes(eventId)) return false;
      if (employmentType !== "all" && row.employmentType !== employmentType) return false;
      if (status !== "all" && row.status !== status) return false;
      if (role !== "all" && row.roleId !== role) return false;
      if (completeness === "complete" && row.missing.length > 0) return false;
      if (completeness === "incomplete" && row.missing.length === 0) return false;
      return true;
    });
  }, [rows, search, eventId, employmentType, status, role, completeness]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every(row => selected.has(row.id));
  const someVisibleSelected = filteredRows.some(row => selected.has(row.id));

  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const row of filteredRows) next.delete(row.id);
      } else {
        for (const row of filteredRows) next.add(row.id);
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setSearch("");
    setEventId("all");
    setEmploymentType("all");
    setStatus("all");
    setRole("all");
    setCompleteness("all");
  };

  const selectAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const row of filteredRows) next.add(row.id);
      return next;
    });
  };

  const generate = async () => {
    setBusy(true); setMessage(""); setResult(null); setMissing([]);
    try {
      const response = await createPayrollExport(Array.from(selected));
      if (!response.success) {
        setMissing(response.missing || []);
        setMessage(response.error || "Export nicht möglich. Bitte fehlende Pflichtfelder ergänzen.");
        return;
      }
      setResult({ url: response.url!, rowCount: response.rowCount!, expiresAt: response.expiresAt! });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const inputCls = "w-full bg-canvas-light border border-border-light rounded-lg p-2.5 text-sm focus:outline-none focus:border-accent-green transition-colors";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">DATEV</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Lohn-Stammdaten exportieren</h1>
        <p className="text-base-dark/60 mt-1">Generisches CSV-Profil für den Steuerberater. Keine Lohnabrechnung.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border-light rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-lg">Filter &amp; Auswahl</h2>
          <div className="flex gap-2">
            <button type="button" onClick={resetFilters} className="text-xs font-bold text-base-dark/60 hover:text-accent-green">Filter zurücksetzen</button>
            <button type="button" onClick={selectAllVisible} className="text-xs font-bold text-accent-green hover:underline">Alle gefilterten auswählen</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-xs font-bold space-y-1">
            Suche
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name …" className={inputCls} />
          </label>
          <label className="text-xs font-bold space-y-1">
            Fest / Event
            <select value={eventId} onChange={e => setEventId(e.target.value)} className={inputCls}>
              <option value="all">Alle Feste / Events</option>
              {events
                .slice()
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({new Date(event.date).toLocaleDateString("de-DE")})
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs font-bold space-y-1">
            Anstellungsart
            <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={inputCls}>
              <option value="all">Alle Anstellungsarten</option>
              {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold space-y-1">
            Status
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="all">Alle Status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold space-y-1">
            Rolle
            <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
              <option value="all">Alle Rollen</option>
              {roles.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold space-y-1">
            Vollständigkeit
            <select value={completeness} onChange={e => setCompleteness(e.target.value)} className={inputCls}>
              <option value="all">Alle</option>
              <option value="complete">Vollständig</option>
              <option value="incomplete">Unvollständig</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-base-dark/50">
          {filteredRows.length} von {rows.length} Mitarbeitern angezeigt · {selected.size} ausgewählt
        </p>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">
          Prüfung ({filteredRows.length} Mitarbeiter)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas-light text-left">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    ref={allCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Alle auswählen"
                    className="w-4 h-4 accent-accent-green"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Rolle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Anstellungsart</th>
                <th className="px-4 py-3">Fehlende Pflichtfelder</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.id} className="border-t border-border-light">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`${row.name} auswählen`}
                      className="w-4 h-4 accent-accent-green"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold">{row.name}</td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">{STATUS_LABELS[row.status] || row.status}</td>
                  <td className="px-4 py-3">{EMPLOYMENT_LABELS[row.employmentType] || row.employmentType}</td>
                  <td className={`px-4 py-3 ${row.missing.length ? "text-red-700 font-bold" : "text-accent-green"}`}>
                    {row.missing.length ? row.missing.join(", ") : "vollständig"}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-base-dark/50">Keine Mitarbeiter passen zu den Filtern.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {message && <p className="text-sm font-bold bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">{message}</p>}
      {missing.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm">
          <p className="font-bold text-red-800 mb-2">Bitte zuerst ergänzen:</p>
          {missing.map(entry => <p key={entry.name} className="text-red-700">{entry.name}: {entry.fields.join(", ")}</p>)}
        </div>
      )}
      {result && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-2xl p-5">
          <p className="font-bold text-accent-green">Export erstellt: {result.rowCount} Zeilen.</p>
          <p className="text-xs text-base-dark/60 mt-1">Einmal-Link gültig bis {new Date(result.expiresAt).toLocaleTimeString("de-DE")}.</p>
          <a href={result.url} className="inline-block mt-3 bg-accent-green text-white px-5 py-3 rounded-xl font-bold">CSV jetzt herunterladen</a>
          <p className="text-xs text-base-dark/50 mt-2">Der Link funktioniert nur einmal. Danach neu erzeugen.</p>
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={busy || selected.size === 0}
        className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
      >
        {busy ? "Wird geprüft…" : `Export erzeugen (${selected.size})`}
      </button>
    </div>
  );
}