"use client";

import { Link } from "@/i18n/routing";
import type { EventRecord } from "@/types/domain";

type Row = { event: EventRecord; totalRequired: number; filled: number; selfSignups: number; gaps: number; requirements: number };

export default function StaffingOverview({ data }: { data: { events: Row[] } }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Personal</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Übersicht aller Feste</h1>
        <p className="text-base-dark/60 mt-1">Offene Schichten, Selbst-Eintragungen und Abdeckung pro Fest.</p>
      </div>
      {data.events.length === 0 ? (
        <p className="bg-white border border-border-light rounded-2xl p-6 text-base-dark/60">Keine kommenden Feste.</p>
      ) : (
        <div className="space-y-3">
          {data.events.map(row => (
            <article key={row.event.id} className="bg-white border border-border-light rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{row.event.title}</p>
                <p className="text-sm text-base-dark/60">{new Date(row.event.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} · {row.event.location}</p>
                <p className="text-xs mt-1">
                  Bedarf {row.totalRequired} · Besetzt {row.filled} · Selbst-Eintragungen {row.selfSignups} · Lücken {row.gaps} · Schichten {row.requirements}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${row.gaps === 0 && row.totalRequired > 0 ? "bg-accent-green/15 text-accent-green" : "bg-amber-100 text-amber-800"}`}>
                  {row.totalRequired === 0 ? "Kein Bedarf" : row.gaps === 0 ? "Voll besetzt" : `${row.gaps} offen`}
                </span>
                <Link href={`/admin/events/${row.event.id}/personal`} className="inline-flex items-center gap-1 min-h-9 px-3 py-1.5 rounded-lg bg-accent-green text-white text-xs font-bold hover:bg-base-dark transition-colors">Einteilen →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
