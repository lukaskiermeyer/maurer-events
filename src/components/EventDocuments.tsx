"use client";

import { useState } from "react";
import type { EventDocument } from "@/types/domain";
import DocumentViewer from "@/components/DocumentViewer";

export default function EventDocuments({ documents, title, locale }: { documents: EventDocument[]; title: string; locale: string }) {
  const [active, setActive] = useState<{ documents: EventDocument[]; title: string } | null>(null);
  const menus = documents.filter(document => document.kind === "menu");
  const programs = documents.filter(document => document.kind === "program");
  if (documents.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="bg-white border border-border-light rounded-3xl p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">{locale === "en" ? "Good to know" : "Gut zu wissen"}</p>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-base-dark mb-5">{(locale === "en" ? "Menu & program" : "Speisekarte & Programm").split(" ").slice(0, -1).join(" ")}{" "}<span className="text-accent-green italic">{(locale === "en" ? "Menu & program" : "Speisekarte & Programm").split(" ").slice(-1)}</span></h2>
          <div className="flex flex-wrap gap-3">
            {menus.length > 0 && (
              <button type="button" onClick={() => setActive({ documents: menus, title })} className="inline-flex items-center gap-3 bg-accent-green text-white px-5 py-3 rounded-full font-bold text-sm hover:bg-accent-green/80 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                {locale === "en" ? "Menu" : "Speisekarte"}
              </button>
            )}
            {programs.length > 0 && (
              <button type="button" onClick={() => setActive({ documents: programs, title })} className="inline-flex items-center gap-3 bg-canvas-light border border-border-light text-base-dark px-5 py-3 rounded-full font-bold text-sm hover:border-accent-green transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                {locale === "en" ? "Program" : "Programm / Bands"}
              </button>
            )}
          </div>
        </div>
      </div>
      <DocumentViewer
        key={active?.documents.map(document => document.id).join(",") || "closed"}
        open={!!active}
        onClose={() => setActive(null)}
        documents={active?.documents || []}
        title={active?.title || title}
        locale={locale}
      />
    </section>
  );
}