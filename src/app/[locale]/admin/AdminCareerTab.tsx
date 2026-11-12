"use client";

import { useState } from "react";

import { updateCareerContent } from "@/app/actions/career";
import type { CareerContent, CareerPosition } from "@/types/domain";

function emptyPosition(): CareerPosition {
  return { id: crypto.randomUUID(), title: "Neue Stelle", badge: "", employment: "", description: "", benefits: [] };
}

export default function AdminCareerTab({ initialContent }: { initialContent: CareerContent }) {
  const [content, setContent] = useState<CareerContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const patch = (changes: Partial<CareerContent>) => setContent(current => ({ ...current, ...changes }));

  const patchPosition = (id: string, changes: Partial<CareerPosition>) =>
    patch({ positions: content.positions.map(position => position.id === id ? { ...position, ...changes } : position) });

  const addPosition = () => patch({ positions: [...content.positions, emptyPosition()] });

  const removePosition = (id: string) => {
    if (!confirm('Diese Stelle wirklich löschen?')) return;
    patch({ positions: content.positions.filter(position => position.id !== id) });
  };

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

  const inputClass = "w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green min-h-11";

  return (
    <form onSubmit={save} className="animate-fade-in space-y-8">
      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <h2 className="text-xl font-bold mb-1">Karriereseite</h2>
        <p className="text-sm text-base-dark/60 mb-6">
          Was hier steht, erscheint sofort auf <span className="font-bold">/karriere</span>. Bewerbungen kommen per E-Mail an das Kontaktpostfach.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="career-headline" className="block text-sm font-bold mb-1 opacity-70">Überschrift</label>
            <input id="career-headline" value={content.headline} maxLength={200} onChange={event => patch({ headline: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="career-headline-en" className="block text-sm font-bold mb-1 opacity-70">Überschrift (Englisch)</label>
            <input id="career-headline-en" value={content.headlineEn ?? ''} maxLength={200} onChange={event => patch({ headlineEn: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="career-intro" className="block text-sm font-bold mb-1 opacity-70">Einleitungstext</label>
            <textarea id="career-intro" value={content.intro} maxLength={2000} rows={4} onChange={event => patch({ intro: event.target.value })} className={`${inputClass} resize-y`} />
          </div>
          <div>
            <label htmlFor="career-intro-en" className="block text-sm font-bold mb-1 opacity-70">Einleitungstext (Englisch)</label>
            <textarea id="career-intro-en" value={content.introEn ?? ''} maxLength={2000} rows={4} onChange={event => patch({ introEn: event.target.value })} className={`${inputClass} resize-y`} />
          </div>
        </div>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Offene Stellen</h2>
          <span className="text-sm text-base-dark/50">{content.positions.length} von 20</span>
        </div>

        {content.positions.length === 0 && (
          <p className="text-sm text-base-dark/60 mb-4">Keine Stellen veröffentlicht. Die Seite zeigt dann nur Einleitung und Bewerbungsformular.</p>
        )}

        <div className="space-y-5">
          {content.positions.map((position, index) => (
            <div key={position.id} className="bg-canvas-light p-4 rounded-xl border border-border-light">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-black uppercase tracking-widest text-base-dark/40">Stelle {index + 1}</span>
                <button type="button" onClick={() => removePosition(position.id)} className="text-red-600 font-bold text-sm px-3 min-h-11 rounded-lg hover:bg-red-50">
                  Löschen
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor={`title-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Stellenbezeichnung</label>
                  <input id={`title-${position.id}`} value={position.title} maxLength={120} onChange={event => patchPosition(position.id, { title: event.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`title-en-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Stellenbezeichnung (Englisch)</label>
                  <input id={`title-en-${position.id}`} value={position.titleEn ?? ''} maxLength={120} onChange={event => patchPosition(position.id, { titleEn: event.target.value })} className={inputClass} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`badge-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Hinweis (z. B. Dringend gesucht)</label>
                    <input id={`badge-${position.id}`} value={position.badge} maxLength={60} onChange={event => patchPosition(position.id, { badge: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`employment-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Anstellungsart</label>
                    <input id={`employment-${position.id}`} value={position.employment} maxLength={60} onChange={event => patchPosition(position.id, { employment: event.target.value })} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`badge-en-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Hinweis (Englisch)</label>
                    <input id={`badge-en-${position.id}`} value={position.badgeEn ?? ''} maxLength={60} onChange={event => patchPosition(position.id, { badgeEn: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`employment-en-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Anstellungsart (Englisch)</label>
                    <input id={`employment-en-${position.id}`} value={position.employmentEn ?? ''} maxLength={60} onChange={event => patchPosition(position.id, { employmentEn: event.target.value })} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label htmlFor={`description-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Beschreibung</label>
                  <textarea id={`description-${position.id}`} value={position.description} maxLength={2000} rows={3} onChange={event => patchPosition(position.id, { description: event.target.value })} className={`${inputClass} resize-y`} />
                </div>
                <div>
                  <label htmlFor={`description-en-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Beschreibung (Englisch)</label>
                  <textarea id={`description-en-${position.id}`} value={position.descriptionEn ?? ''} maxLength={2000} rows={3} onChange={event => patchPosition(position.id, { descriptionEn: event.target.value })} className={`${inputClass} resize-y`} />
                </div>

                <div>
                  <label htmlFor={`benefits-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Vorteile (eine Zeile pro Punkt)</label>
                  <textarea
                    id={`benefits-${position.id}`}
                    value={position.benefits.join('\n')}
                    rows={3}
                    onChange={event => patchPosition(position.id, { benefits: event.target.value.split('\n') })}
                    className={`${inputClass} resize-y`}
                  />
                </div>
                <div>
                  <label htmlFor={`benefits-en-${position.id}`} className="block text-xs font-bold uppercase mb-1 opacity-70">Vorteile (Englisch, eine Zeile pro Punkt)</label>
                  <textarea
                    id={`benefits-en-${position.id}`}
                    value={(position.benefitsEn ?? []).join('\n')}
                    rows={3}
                    onChange={event => patchPosition(position.id, { benefitsEn: event.target.value.split('\n') })}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addPosition} disabled={content.positions.length >= 20} className="mt-4 bg-base-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-accent-green transition-colors min-h-12 disabled:opacity-40">
          + Stelle hinzufügen
        </button>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <h2 className="text-xl font-bold mb-4">Abschluss</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="career-closing-title" className="block text-sm font-bold mb-1 opacity-70">Überschrift</label>
            <input id="career-closing-title" value={content.closingTitle} maxLength={120} onChange={event => patch({ closingTitle: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="career-closing-title-en" className="block text-sm font-bold mb-1 opacity-70">Überschrift (Englisch)</label>
            <input id="career-closing-title-en" value={content.closingTitleEn ?? ''} maxLength={120} onChange={event => patch({ closingTitleEn: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="career-closing-text" className="block text-sm font-bold mb-1 opacity-70">Text</label>
            <textarea id="career-closing-text" value={content.closingText} maxLength={1000} rows={3} onChange={event => patch({ closingText: event.target.value })} className={`${inputClass} resize-y`} />
          </div>
          <div>
            <label htmlFor="career-closing-text-en" className="block text-sm font-bold mb-1 opacity-70">Text (Englisch)</label>
            <textarea id="career-closing-text-en" value={content.closingTextEn ?? ''} maxLength={1000} rows={3} onChange={event => patch({ closingTextEn: event.target.value })} className={`${inputClass} resize-y`} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 bg-base-light/95 backdrop-blur border-t border-border-light py-4 -mx-4 px-4">
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={isSaving} className="bg-accent-green text-white font-bold uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-base-dark transition-colors min-h-12 disabled:opacity-50">
            {isSaving ? 'Speichert…' : 'Karriereseite speichern'}
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