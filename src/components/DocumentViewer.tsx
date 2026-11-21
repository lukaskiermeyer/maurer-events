"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { EventDocument } from "@/types/domain";
import { ui, localized } from "@/lib/localize";

export default function DocumentViewer({
  open,
  onClose,
  documents,
  title,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  documents: EventDocument[];
  title: string;
  locale: string;
}) {
  const [index, setIndex] = useState(0);
  const activeDocument = documents[index];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex(current => Math.min(documents.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex(current => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKey);
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); window.document.body.style.overflow = previous; };
  }, [open, documents.length, onClose]);

  if (!open || !activeDocument) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-base-dark/90 backdrop-blur-md p-3 md:p-8 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={ui(locale, { de: "Schließen", en: "Close", bar: "Schliaßn" })}
        className="absolute top-4 right-4 md:top-8 md:right-8 z-30 w-12 h-12 rounded-full bg-white/90 text-base-dark flex items-center justify-center hover:bg-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 text-white mb-3 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{title}</p>
            <h2 className="font-display font-bold text-lg md:text-2xl truncate">{localized(activeDocument, "title", locale)}</h2>
          </div>
          <a href={`/api/documents/${activeDocument.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 bg-white text-base-dark px-4 py-2 rounded-full text-sm font-bold hover:bg-canvas-light transition-colors">
            {ui(locale, { de: "Datei öffnen", en: "Open file", bar: "Datei aufmachn" })}
          </a>
        </div>

        <div className="relative flex-1 min-h-0 bg-white rounded-2xl overflow-hidden">
          {activeDocument.previewUrl ? (
            <div className="relative w-full h-[72vh] max-h-[75vh]">
              <Image src={activeDocument.previewUrl} alt={activeDocument.title} fill sizes="90vw" className="object-contain" priority />
            </div>
          ) : (
            <div className="h-[55vh] flex flex-col items-center justify-center text-center p-8">
              <span className="font-display font-black text-5xl text-accent-green">PDF</span>
              <p className="mt-3 text-base-dark/60">{ui(locale, { de: "Für dieses PDF ist keine Vorschau verfügbar. Bitte die Datei öffnen.", en: "PDF preview is not available. Please open the file.", bar: "Für des PDF gibt's koa Vorschau. Bitte d'Datei aufmachn." })}</p>
              <a href={`/api/documents/${activeDocument.id}`} target="_blank" rel="noopener noreferrer" className="mt-5 bg-accent-green text-white px-5 py-2.5 rounded-full font-bold text-sm">
                {ui(locale, { de: "PDF öffnen", en: "Open PDF", bar: "PDF aufmachn" })}
              </a>
            </div>
          )}
        </div>

        {documents.length > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <button type="button" onClick={() => setIndex(current => Math.max(0, current - 1))} disabled={index === 0} className="w-11 h-11 rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors" aria-label="Zurück">
              ←
            </button>
            <span className="text-white/70 text-sm font-bold">{index + 1} / {documents.length}</span>
            <button type="button" onClick={() => setIndex(current => Math.min(documents.length - 1, current + 1))} disabled={index === documents.length - 1} className="w-11 h-11 rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors" aria-label="Weiter">
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}