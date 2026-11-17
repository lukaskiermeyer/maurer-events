"use client";

import { useMemo, useState } from "react";
import { CUSTOMER_FIELDS, mapImportRows, parseCsv, type CustomerField } from "@/lib/customer-import";
import { importCustomers } from "@/app/actions/customers";
import DropZone from "@/components/ui/DropZone";

function guessColumn(headers: string[], field: CustomerField) {
  const checks: Record<CustomerField, RegExp> = {
    displayName: /name|kunde|gast/i,
    company: /verein|firma|company|organisation/i,
    email: /mail/i,
    phone: /tel|phone|mobil|handy/i,
    street: /stra|strasse|adresse/i,
    zip: /plz|postleitzahl|zip/i,
    city: /ort|stadt|city/i,
    notes: /notiz|note|bemerkung/i,
    externalRef: /id|nr|nummer|ticket/i,
  };
  const index = headers.findIndex(header => checks[field].test(header));
  return index >= 0 ? index : undefined;
}

export default function CustomerImport({ onClose }: { onClose: () => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CustomerField, number>>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const [error, setError] = useState("");

  const preview = useMemo(() => mapImportRows(headers, rows, mapping).slice(0, 5), [headers, rows, mapping]);
  const mappedRows = useMemo(() => mapImportRows(headers, rows, mapping), [headers, rows, mapping]);
  const missingName = mapping.displayName === undefined;

  const readFile = async (file: File | undefined) => {
    setResult(null);
    setError("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("CSV ist zu groß (max. 5 MB)."); return; }
    setFileName(file.name);
    try {
      const parsed = parseCsv(await file.text());
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      const guessed: Partial<Record<CustomerField, number>> = {};
      for (const field of CUSTOMER_FIELDS) {
        const index = guessColumn(parsed.headers, field.key);
        if (index !== undefined) guessed[field.key] = index;
      }
      setMapping(guessed);
    } catch {
      setError("CSV konnte nicht gelesen werden.");
    }
  };

  const startImport = async () => {
    if (missingName) { setError("Bitte die Spalte für den Namen zuordnen."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await importCustomers({ fileName, rows: mappedRows });
      setResult({ created: response.created, updated: response.updated, skipped: response.skipped, errors: response.errors });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-border-light rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-xl">SnapTicket / CSV importieren</h2>
          <p className="text-sm text-base-dark/60">Nur Kundenstammdaten. Keine alten Reservierungen oder Umsätze.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-bold text-base-dark/60 hover:text-base-dark">Schließen</button>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase mb-1">CSV-Datei (Semikolon oder Komma)</label>
        <DropZone
          accept=".csv,text/csv"
          label="CSV-Datei hierher ziehen oder klicken"
          hint="Semikolon oder Komma"
          onFiles={files => readFile(files[0])}
        />
      </div>

      {headers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CUSTOMER_FIELDS.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-bold uppercase mb-1">{field.label}{field.required ? " *" : ""}</label>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value === "" ? undefined : Number(event.target.value) }))}
                  className="w-full bg-base-light border border-border-light rounded-lg p-2 text-sm"
                >
                  <option value="">– nicht importieren –</option>
                  {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Spalte ${index + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-border-light rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-left">
                <tr>{CUSTOMER_FIELDS.map(field => <th key={field.key} className="px-3 py-2 font-bold whitespace-nowrap">{field.label}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map(row => (
                  <tr key={String(row.rowNumber)} className="border-t border-border-light">
                    {CUSTOMER_FIELDS.map(field => <td key={field.key} className="px-3 py-2 text-base-dark/70 max-w-[180px] truncate">{row[field.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-base-dark/50">{rows.length} Zeilen erkannt. Vorschau zeigt maximal 5.</p>
        </>
      )}

      {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      {result && (
        <div className="text-sm bg-accent-green/10 border border-accent-green/30 rounded-xl p-4">
          <p className="font-bold">Import abgeschlossen: {result.created} neu, {result.updated} aktualisiert, {result.skipped} übersprungen.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-red-700">
              {result.errors.slice(0, 10).map((entry, index) => <li key={index}>Zeile {entry.row}: {entry.message}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={startImport} disabled={busy || rows.length === 0 || missingName} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-base-dark transition-colors">
          {busy ? "Wird importiert…" : "Import starten"}
        </button>
        {result && <button type="button" onClick={() => window.location.reload()} className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-accent-green transition-colors">Kundenliste neu laden</button>}
      </div>
    </div>
  );
}