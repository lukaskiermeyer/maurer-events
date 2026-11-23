"use client";

import { useState } from "react";

import { updateCareerContent } from "@/app/actions/career";
import { translateTextsNow } from "@/app/actions/translations";
import LocalizedFields, { type Lang, type LocValues } from "@/components/admin/LocalizedFields";
import type { CareerContent, CareerPosition } from "@/types/domain";
import { useDialog } from "@/components/ui/Dialog";

const locSuffix = (lang: Lang) => (lang === "de" ? "" : lang === "en" ? "En" : "Bar");

function emptyPosition(): CareerPosition {
  return { id: crypto.randomUUID(), title: "Neue Stelle", badge: "", employment: "", description: "", benefits: [] };
}

export default function AdminCareerTab({ initialContent }: { initialContent: CareerContent }) {
  const [content, setContent] = useState<CareerContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const dialog = useDialog();

  const scalarValues: LocValues = {
    headline: { de: content.headline, en: content.headlineEn ?? "", bar: content.headlineBar ?? "" },
    intro: { de: content.intro, en: content.introEn ?? "", bar: content.introBar ?? "" },
  };
  const closingValues: LocValues = {
    closingTitle: { de: content.closingTitle, en: content.closingTitleEn ?? "", bar: content.closingTitleBar ?? "" },
    closingText: { de: content.closingText, en: content.closingTextEn ?? "", bar: content.closingTextBar ?? "" },
  };
  const positionValues = (p: CareerPosition): LocValues => ({
    title: { de: p.title, en: p.titleEn ?? "", bar: p.titleBar ?? "" },
    badge: { de: p.badge, en: p.badgeEn ?? "", bar: p.badgeBar ?? "" },
    employment: { de: p.employment, en: p.employmentEn ?? "", bar: p.employmentBar ?? "" },
    description: { de: p.description, en: p.descriptionEn ?? "", bar: p.descriptionBar ?? "" },
    benefits: { de: p.benefits.join("\n"), en: (p.benefitsEn ?? []).join("\n"), bar: (p.benefitsBar ?? []).join("\n") },
  });
  const handleScalarChange = (key: string, lang: Lang, v: string) => patch({ [`${key}${locSuffix(lang)}`]: v } as Partial<CareerContent>);
  const handleClosingChange = handleScalarChange;
  const handlePositionChange = (id: string, key: string, lang: Lang, v: string) => {
    const field = `${key}${locSuffix(lang)}`;
    patchPosition(id, (key === "benefits" ? { [field]: v.split("\n") } : { [field]: v }) as Partial<CareerPosition>);
  };
  const translateScalar = async () => {
    setTranslatingKey("scalar");
    try {
      const t = await translateTextsNow({ headline: content.headline, intro: content.intro });
      patch({
        headlineEn: t.en.headline ?? content.headlineEn, headlineBar: t.bar.headline ?? content.headlineBar,
        introEn: t.en.intro ?? content.introEn, introBar: t.bar.intro ?? content.introBar,
      });
    } finally { setTranslatingKey(null); }
  };
  const translateClosing = async () => {
    setTranslatingKey("closing");
    try {
      const t = await translateTextsNow({ closingTitle: content.closingTitle, closingText: content.closingText });
      patch({
        closingTitleEn: t.en.closingTitle ?? content.closingTitleEn, closingTitleBar: t.bar.closingTitle ?? content.closingTitleBar,
        closingTextEn: t.en.closingText ?? content.closingTextEn, closingTextBar: t.bar.closingText ?? content.closingTextBar,
      });
    } finally { setTranslatingKey(null); }
  };
  const translatePosition = async (p: CareerPosition) => {
    setTranslatingKey(p.id);
    try {
      const t = await translateTextsNow({ title: p.title, badge: p.badge, employment: p.employment, description: p.description, benefits: p.benefits.join("\n") });
      patchPosition(p.id, {
        titleEn: t.en.title ?? p.titleEn, titleBar: t.bar.title ?? p.titleBar,
        badgeEn: t.en.badge ?? p.badgeEn, badgeBar: t.bar.badge ?? p.badgeBar,
        employmentEn: t.en.employment ?? p.employmentEn, employmentBar: t.bar.employment ?? p.employmentBar,
        descriptionEn: t.en.description ?? p.descriptionEn, descriptionBar: t.bar.description ?? p.descriptionBar,
        benefitsEn: (t.en.benefits ?? p.benefits.join("\n")).split("\n"), benefitsBar: (t.bar.benefits ?? p.benefits.join("\n")).split("\n"),
      });
    } finally { setTranslatingKey(null); }
  };

  const patch = (changes: Partial<CareerContent>) => setContent(current => ({ ...current, ...changes }));

  const patchPosition = (id: string, changes: Partial<CareerPosition>) =>
    patch({ positions: content.positions.map(position => position.id === id ? { ...position, ...changes } : position) });

  const addPosition = () => patch({ positions: [...content.positions, emptyPosition()] });

  const removePosition = async (id: string) => {
    if (!await dialog.confirm({ title: "Stelle löschen", message: "Diese Stelle wirklich löschen?", danger: true, confirmLabel: "Löschen" })) return;
    patch({ positions: content.positions.filter(position => position.id !== id) });
  };

  const movePosition = (id: string, direction: -1 | 1) => {
    const positions = [...content.positions];
    const index = positions.findIndex(position => position.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= positions.length) return;
    [positions[index], positions[target]] = [positions[target], positions[index]];
    patch({ positions });
  };

  const toggleExpanded = (id: string) => setExpandedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const saved = await updateCareerContent(content);
      setContent(saved);
      setNotice({ kind: 'ok', text: 'Karriereseite gespeichert.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Speichern fehlgeschlagen.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="animate-fade-in space-y-8">
      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <h2 className="text-xl font-bold mb-1">Karriereseite</h2>
        <p className="text-sm text-base-dark/60 mb-6">
          Was hier steht, erscheint sofort auf <span className="font-bold">/karriere</span>. Bewerbungen kommen per E-Mail an das Kontaktpostfach.
        </p>

        <LocalizedFields
          fields={[
            { key: "headline", label: "Überschrift" },
            { key: "intro", label: "Einleitungstext", multiline: true, rows: 4 },
          ]}
          values={scalarValues}
          onChange={handleScalarChange}
          onTranslate={translateScalar}
          translating={translatingKey === "scalar"}
        />
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Offene Stellen</h2>
          <span className="text-sm text-base-dark/50">{content.positions.length} von 20</span>
        </div>

        {content.positions.length === 0 && (
          <p className="text-sm text-base-dark/60 mb-4">Keine Stellen veröffentlicht. Die Seite zeigt dann nur Einleitung und Bewerbungsformular.</p>
        )}

        <div className="space-y-4">
          {content.positions.map((position, index) => {
            const isExpanded = expandedIds.has(position.id);
            return (
              <div key={position.id} className="bg-canvas-light rounded-xl border border-border-light overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button type="button" onClick={() => toggleExpanded(position.id)} className="flex items-center gap-3 min-w-0 text-left flex-1" aria-expanded={isExpanded}>
                    <span className="text-xs font-black uppercase tracking-widest text-base-dark/40 shrink-0">Stelle {index + 1}</span>
                    <span className="font-bold text-base-dark truncate">{position.title || 'Ohne Titel'}</span>
                    <svg className={`w-4 h-4 shrink-0 text-base-dark/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => movePosition(position.id, -1)}
                      disabled={index === 0}
                      aria-label="Nach oben"
                      className="group inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border-light bg-white text-base-dark/70 hover:text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-30 disabled:hover:text-base-dark/70 disabled:hover:border-border-light disabled:hover:bg-white transition-all"
                    >
                      <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => movePosition(position.id, 1)}
                      disabled={index === content.positions.length - 1}
                      aria-label="Nach unten"
                      className="group inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border-light bg-white text-base-dark/70 hover:text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-30 disabled:hover:text-base-dark/70 disabled:hover:border-border-light disabled:hover:bg-white transition-all"
                    >
                      <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="w-px h-6 bg-border-light mx-1" />
                    <button type="button" onClick={() => removePosition(position.id)} className="inline-flex items-center justify-center min-h-10 px-3 rounded-lg text-red-600 font-bold text-sm hover:bg-red-50 transition-colors">
                      Löschen
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-3 p-4 pt-0 border-t border-border-light/60">
                    <LocalizedFields
                      fields={[
                        { key: "title", label: "Stellenbezeichnung" },
                        { key: "badge", label: "Hinweis (z. B. Dringend gesucht)" },
                        { key: "employment", label: "Anstellungsart" },
                        { key: "description", label: "Beschreibung", multiline: true, rows: 3 },
                        { key: "benefits", label: "Vorteile (eine Zeile pro Punkt)", multiline: true, rows: 3 },
                      ]}
                      values={positionValues(position)}
                      onChange={(key, lang, v) => handlePositionChange(position.id, key, lang, v)}
                      onTranslate={() => translatePosition(position)}
                      translating={translatingKey === position.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addPosition} disabled={content.positions.length >= 20} className="mt-4 bg-base-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-accent-green transition-colors min-h-12 disabled:opacity-40">
          + Stelle hinzufügen
        </button>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <h2 className="text-xl font-bold mb-4">Abschluss</h2>
        <LocalizedFields
          fields={[
            { key: "closingTitle", label: "Überschrift" },
            { key: "closingText", label: "Text", multiline: true, rows: 3 },
          ]}
          values={closingValues}
          onChange={handleClosingChange}
          onTranslate={translateClosing}
          translating={translatingKey === "closing"}
        />
      </section>

      <div className="sticky bottom-0 bg-base-light/95 backdrop-blur border-t border-border-light py-4 -mx-4 px-4">
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={isSaving} className="bg-accent-green text-white font-bold uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-base-dark transition-colors min-h-12 disabled:opacity-50">
            {isSaving ? 'Speichert...' : 'Karriereseite speichern'}
          </button>
          <div aria-live="polite" className="min-w-0">
            {notice && (
              <span className={`text-sm font-bold break-words ${notice.kind === 'ok' ? 'text-accent-green' : 'text-red-600'}`}>{notice.text}</span>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}