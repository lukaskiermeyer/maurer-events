"use client";

import { useState } from "react";
import { createPayrollExport } from "@/app/actions/payroll";

type StatusRow = { id: string; name: string; role: string; status: string; missing: string[] };

export default function PayrollExportClient({ rows }: { rows: StatusRow[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ url: string; rowCount: number; expiresAt: string } | null>(null);
  const [missing, setMissing] = useState<Array<{ name: string; fields: string[] }>>([]);

  const generate = async () => {
    setBusy(true); setMessage(""); setResult(null); setMissing([]);
    try {
      const response = await createPayrollExport();
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">DATEV</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Lohn-Stammdaten exportieren</h1>
        <p className="text-base-dark/60 mt-1">Generisches CSV-Profil für den Steuerberater. Keine Lohnabrechnung.</p>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Prüfung ({rows.length} Mitarbeiter)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Fehlende Pflichtfelder</th></tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.id} className="border-t border-border-light">
                <td className="px-4 py-3 font-bold">{row.name}</td>
                <td className="px-4 py-3">{row.role}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className={`px-4 py-3 ${row.missing.length ? "text-red-700 font-bold" : "text-accent-green"}`}>
                  {row.missing.length ? row.missing.join(", ") : "vollständig"}
                </td>
              </tr>
            ))}</tbody>
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

      <button type="button" onClick={generate} disabled={busy} className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird geprüft…" : "Export erzeugen"}</button>
    </div>
  );
}