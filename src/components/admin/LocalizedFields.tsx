"use client";

import { useState } from "react";
import MarkdownEditor from "@/components/admin/MarkdownEditor";

export type Lang = "de" | "en" | "bar";
export const LANGS: { key: Lang; label: string }[] = [
  { key: "de", label: "Deutsch" },
  { key: "en", label: "English" },
  { key: "bar", label: "Bairisch" },
];

export interface LocField {
  key: string;
  label: string;
  multiline?: boolean;
  markdown?: boolean;
  rows?: number;
}

export type LocValues = Record<string, Record<Lang, string>>;

export function emptyLocValues(fields: LocField[], init?: Record<string, Partial<Record<Lang, string | null>>>): LocValues {
  const out: LocValues = {};
  for (const f of fields) {
    out[f.key] = {
      de: init?.[f.key]?.de ?? "",
      en: init?.[f.key]?.en ?? "",
      bar: init?.[f.key]?.bar ?? "",
    };
  }
  return out;
}

// Sprachauswahl für alle 3 Sprachen + KI-Übersetzen-Button (NIM).
// Werte bleiben pro Sprache manuell editierbar und werden mit gespeichert.
export default function LocalizedFields({ fields, values, onChange, onTranslate, translating }: {
  fields: LocField[];
  values: LocValues;
  onChange: (key: string, lang: Lang, value: string) => void;
  onTranslate: () => void;
  translating?: boolean;
}) {
  const [lang, setLang] = useState<Lang>("de");
  return (
    <div className="space-y-3 rounded-xl border border-border-light bg-canvas-light/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border-light bg-white p-1" role="tablist" aria-label="Sprache">
          {LANGS.map(l => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={lang === l.key}
              onClick={() => setLang(l.key)}
              className={`min-h-9 rounded-md px-3 text-xs font-bold transition-colors ${lang === l.key ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}
            >
              {l.label}
              {l.key !== "de" && !values[fields[0]?.key]?.[l.key]?.trim() ? " ·" : ""}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onTranslate}
          disabled={translating}
          className="min-h-9 rounded-lg bg-base-dark px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          {translating ? "KI übersetzt… (kann ~1 min dauern)" : "Mit KI übersetzen (EN + Bairisch)"}
        </button>
      </div>
      <p className="text-xs text-base-dark/60">
        {lang === "de" ? "Deutsch ist die Quelle für die KI-Übersetzung." : `Die KI übersetzt aus Deutsch nach ${LANGS.find(l => l.key === lang)?.label}. Ergebnisse sind hier manuell editierbar und werden mit gespeichert.`}
        {" "}Ein Punkt am Tab markiert leere Übersetzungen.
      </p>
      {fields.map(f => (
        <div key={f.key}>
          {f.markdown ? (
            <MarkdownEditor
              label={`${f.label}${lang !== "de" ? ` (${LANGS.find(l => l.key === lang)?.label})` : ""}`}
              value={values[f.key]?.[lang] ?? ""}
              onChange={v => onChange(f.key, lang, v)}
              collapsedByDefault={lang !== "de"}
              rows={f.rows ?? 6}
            />
          ) : (
            <>
          <label className="block text-xs font-bold uppercase mb-1 opacity-70">{f.label}{lang !== "de" ? ` (${LANGS.find(l => l.key === lang)?.label})` : ""}</label>
          {f.multiline ? (
            <textarea
              value={values[f.key]?.[lang] ?? ""}
              onChange={e => onChange(f.key, lang, e.target.value)}
              rows={f.rows ?? 5}
              className="w-full border border-border-light rounded-lg p-3 bg-white font-sans text-sm focus:outline-none focus:border-accent-green"
            />
          ) : (
            <input
              value={values[f.key]?.[lang] ?? ""}
              onChange={e => onChange(f.key, lang, e.target.value)}
              className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
            />
          )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}