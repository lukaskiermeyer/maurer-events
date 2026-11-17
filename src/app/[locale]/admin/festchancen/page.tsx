import { requireAdmin } from "@/lib/auth";
import { getFestOpportunities, getFestRuns, getFestChances, triggerN8nWebhook, updateFestOpportunityStatus, updateFestChanceWirt } from "@/app/actions/festchancen";
import StaffHeader from "@/components/admin/StaffHeader";
import { Link } from "@/i18n/routing";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function FestChancenPage() {
  await requireAdmin(true);
  const [opportunities, runs, openLeads, watchLeads] = await Promise.all([
    getFestOpportunities(),
    getFestRuns(),
    getFestChances("open"),
    getFestChances("watch"),
  ]);

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-green/10 via-white to-accent-wood/10 border border-border-light p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">
                &larr; Zurück zum Admin
              </Link>
              <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Fest-Chancen</h1>
              <p className="mt-2 text-base-dark/60">Gefundene Vereinsjubiläen & Feste aus n8n. Du entscheidest, ob wir uns bewerben.</p>
            </div>
            <form action={async () => { "use server"; await triggerN8nWebhook(); revalidatePath("/[locale]/admin/festchancen", "page"); }}>
              <button type="submit" className="min-h-12 inline-flex items-center gap-2 px-6 rounded-xl bg-accent-green text-white font-bold shadow-lg shadow-accent-green/25 hover:opacity-90 transition">
                <span aria-hidden>🔍</span> Jetzt in n8n suchen
              </button>
            </form>
          </div>
        </div>

        {/* Runs */}
        {runs.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-2xl border border-border-light shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-base-dark/50 mb-2">Letzte Läufe</h2>
            <ul className="text-sm space-y-2">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 text-base-dark/70">
                  <span className="font-mono text-xs bg-base-light px-2 py-0.5 rounded-md">{r.runId}</span>
                  <span>{new Date(r.createdAt).toLocaleString("de-DE")}</span>
                  <span className="text-xs">gefunden: <b>{r.foundCount}</b>, gesynct: <b>{r.syncedCount}</b></span>
                  {r.error && <span className="text-red-600 text-xs">{r.error.slice(0, 120)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Heiß (open) */}
        <div className="mb-8">
          <h2 className="text-xl font-display font-bold text-base-dark mb-3">🔥 Heiß (open)</h2>
          {openLeads.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">Keine offenen Hot-Leads.</div>
          ) : (
            <div className="space-y-3">
              {openLeads.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-border-light shadow-sm p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${o.score >= 85 ? "bg-red-100 text-red-800" : o.score >= 60 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>Score {o.score}</span>
                        {o.region && <span className="text-xs font-bold uppercase text-base-dark/40">{o.region}</span>}
                        <span className="text-xs text-base-dark/40">Wirt: {o.wirtStatus}</span>
                      </div>
                      <h3 className="font-bold text-base-dark">{o.title || o.sourceUrl}</h3>
                      <p className="text-sm text-base-dark/60">{o.organizer || "—"} · {o.location || "—"} · {o.eventDate ? new Date(o.eventDate).toLocaleDateString("de-DE") : "Datum offen"}</p>
                      {o.scoreReason && <p className="text-xs text-base-dark/50 mt-1">{o.scoreReason}</p>}
                      {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-green hover:underline break-all mt-1 inline-block">Quelle öffnen ↗</a>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["neu", "kontaktiert", "im_gespraech", "angebot", "gewonnen", "verloren", "vertagt"].map((s) => (
                        <form key={s} action={async () => { "use server"; await updateFestChanceWirt(o.id, s); }}>
                          <button type="submit" className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${o.wirtStatus === s ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark/60 border-border-light hover:border-accent-green"}`}>{s}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div className="mb-8">
          <h2 className="text-xl font-display font-bold text-base-dark mb-3">👁 Watchlist (watch, recheckAt)</h2>
          {watchLeads.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">Keine Watch-Leads.</div>
          ) : (
            <div className="space-y-3">
              {watchLeads.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-border-light shadow-sm p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">Score {o.score}</span>
                        {o.region && <span className="text-xs font-bold uppercase text-base-dark/40">{o.region}</span>}
                        {o.recheckAt && <span className="text-xs text-amber-700 font-bold">Fällig: {new Date(o.recheckAt).toLocaleDateString("de-DE")}</span>}
                      </div>
                      <h3 className="font-bold text-base-dark">{o.title || o.sourceUrl}</h3>
                      <p className="text-sm text-base-dark/60">{o.organizer || "—"} · {o.location || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opportunities (legacy) */}
        {opportunities.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-dashed border-border-light text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-base-dark/60">Noch keine Fest-Chancen. Starte eine Suche mit „Jetzt in n8n suchen“.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((o) => (
              <div key={o.id} className="group bg-white rounded-2xl border border-border-light shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${o.score >= 80 ? "bg-emerald-100 text-emerald-800" : o.score >= 60 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                          Score {o.score}
                        </span>
                        {o.region && <span className="text-xs font-bold uppercase tracking-wide text-base-dark/40">{o.region}</span>}
                        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${o.status === 'won' ? 'bg-emerald-50 text-emerald-700' : o.status === 'lost' ? 'bg-red-50 text-red-700' : o.status === 'applied' ? 'bg-blue-50 text-blue-700' : 'bg-base-light text-base-dark/50'}`}>{o.status}</span>
                        {o.jubileeYears && <span className="text-xs font-bold text-accent-wood">{o.jubileeYears} Jahre</span>}
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-base-dark leading-snug">{o.title || "Ohne Titel"}</h3>
                      <p className="text-sm text-base-dark/60 mt-1">{o.organizer || "—"} · {o.location || "—"} · {o.eventDate ? new Date(o.eventDate).toLocaleDateString("de-DE") : "Datum offen"}</p>
                      {o.scoreReason && <p className="text-xs text-base-dark/50 mt-2">{o.scoreReason}</p>}
                      {o.contactEmail && <p className="text-xs mt-2 text-base-dark/60">Kontakt: {o.contactName || ""} · {o.contactEmail} {o.contactPhone ? `· ${o.contactPhone}` : ""}</p>}
                      {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-green hover:underline break-all mt-2 inline-block">Quelle öffnen ↗</a>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:max-w-[260px] justify-end">
                      {["new", "reviewing", "applied", "contacted", "won", "lost", "ignore"].map((s) => (
                        <form key={s} action={async () => { "use server"; await updateFestOpportunityStatus(o.id, s); }}>
                          <button type="submit" className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition ${o.status === s ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark/60 border-border-light hover:border-accent-green hover:text-accent-green"}`}>
                            {s}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}