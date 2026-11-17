import { requireAdmin } from "@/lib/auth";
import { getFestOpportunities, getFestRuns, getFestChances, triggerN8nWebhook, updateFestOpportunityStatus, updateFestChanceWirt, deleteFestChance, deleteFestOpportunity, getVereinsRadar, updateVereinsRadarWirt, deleteVereinsRadar } from "@/app/actions/festchancen";
import StaffHeader from "@/components/admin/StaffHeader";
import ChanceStatusSelect from "@/components/admin/ChanceStatusSelect";
import { Link } from "@/i18n/routing";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const WIRT_STATUS_OPTIONS = [
  { value: "neu", label: "Neu" },
  { value: "kontaktiert", label: "Kontaktiert" },
  { value: "im_gespraech", label: "Im Gespräch" },
  { value: "angebot", label: "Angebot" },
  { value: "gewonnen", label: "Gewonnen" },
  { value: "verloren", label: "Verloren" },
  { value: "vertagt", label: "Vertagt" },
];

const OPPORTUNITY_STATUS_OPTIONS = [
  { value: "new", label: "Neu" },
  { value: "reviewing", label: "Prüfen" },
  { value: "applied", label: "Beworben" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
];

export default async function FestChancenPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin(true);
  const params = await searchParams;
  const activeTab = params?.tab === "verein" ? "verein" : "fest";

  const [opportunities, runs, openLeads, watchLeads, vereinConnecten, vereinJetzt, vereinBeobachten] = await Promise.all([
    getFestOpportunities(),
    getFestRuns(),
    getFestChances("open"),
    getFestChances("watch"),
    getVereinsRadar("connecten"),
    getVereinsRadar("jetzt_anbieten"),
    getVereinsRadar("beobachten"),
  ]);

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        {/* Tab Navigation */}
        <div className="grid grid-cols-2 bg-white p-1 rounded-xl border border-border-light shadow-sm w-full sm:w-fit mb-6">
          <Link
            href="/admin/festchancen"
            className={`px-2 sm:px-6 min-h-12 rounded-lg font-bold text-sm transition-all duration-200 text-center ${
              activeTab === "fest"
                ? 'bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20'
                : 'text-base-dark/50 hover:text-base-dark hover:bg-base-light'
            }`}
          >
            Fest-Chancen
          </Link>
          <Link
            href="/admin/festchancen?tab=verein"
            className={`px-2 sm:px-6 min-h-12 rounded-lg font-bold text-sm transition-all duration-200 text-center ${
              activeTab === "verein"
                ? 'bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20'
                : 'text-base-dark/50 hover:text-base-dark hover:bg-base-light'
            }`}
          >
            Vereins-Radar
          </Link>
        </div>

        {activeTab === "fest" && (
          <>
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
                        <div className="flex items-center gap-2">
                          <ChanceStatusSelect value={o.wirtStatus} options={WIRT_STATUS_OPTIONS} action={updateFestChanceWirt.bind(null, o.id)} label={`Status für ${o.title || "Chance"}`} />
                          <form action={async () => { "use server"; await deleteFestChance(o.id); }}>
                            <button type="submit" title="Löschen – wird bei künftigen Suchläufen übersprungen" aria-label={`Chance löschen: ${o.title || o.sourceUrl}`} className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition">
                              <span aria-hidden>🗑</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                          {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-green hover:underline break-all mt-1 inline-block">Quelle öffnen ↗</a>}
                        </div>
                        <div className="flex items-center gap-2">
                          <ChanceStatusSelect value={o.wirtStatus} options={WIRT_STATUS_OPTIONS} action={updateFestChanceWirt.bind(null, o.id)} label={`Status für ${o.title || "Chance"}`} />
                          <form action={async () => { "use server"; await deleteFestChance(o.id); }}>
                            <button type="submit" title="Löschen – wird bei künftigen Suchläufen übersprungen" aria-label={`Chance löschen: ${o.title || o.sourceUrl}`} className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition">
                              <span aria-hidden>🗑</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h2 className="text-xl font-display font-bold text-base-dark mb-1">🗂 Gesamtliste</h2>
            <p className="text-sm text-base-dark/50 mb-3">Alle Sync-Einträge inklusive Heiß & Watchlist.</p>
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
                        <div className="flex items-center gap-2 sm:max-w-[260px] justify-end">
                          <ChanceStatusSelect value={o.status} options={OPPORTUNITY_STATUS_OPTIONS} action={updateFestOpportunityStatus.bind(null, o.id)} label={`Status für ${o.title || "Chance"}`} />
                          <form action={async () => { "use server"; await deleteFestOpportunity(o.id); }}>
                            <button type="submit" title="Löschen – wird bei künftigen Suchläufen übersprungen" aria-label={`Chance löschen: ${o.title || o.sourceUrl}`} className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition">
                              <span aria-hidden>🗑</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "verein" && (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-green/10 via-white to-accent-wood/10 border border-border-light p-6 sm:p-8 mb-8 shadow-sm">
              <div>
                <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">
                  &larr; Zurück zum Admin
                </Link>
                <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Vereins-Radar</h1>
                <p className="mt-2 text-base-dark/60">Radar-Leads aus n8n. Status: connecten / jetzt anbieten / beobachten.</p>
              </div>
            </div>

            {[
              { title: "🎯 Radar (connecten)", items: vereinConnecten },
              { title: "⚡ Jetzt anbieten", items: vereinJetzt },
              { title: "👁 Beobachten", items: vereinBeobachten },
            ].map(({ title, items }) => (
              <div key={title} className="mb-8">
                <h2 className="text-xl font-display font-bold text-base-dark mb-3">{title} ({items.length})</h2>
                {items.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">Keine Einträge.</div>
                ) : (
                  <div className="space-y-3">
                    {items.map((r) => (
                      <div key={r.id} className="bg-white rounded-2xl border border-border-light shadow-sm p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${r.score >= 80 ? "bg-red-100 text-red-800" : r.score >= 60 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>Score {r.score}</span>
                              {r.region && <span className="text-xs font-bold uppercase text-base-dark/40">{r.region}</span>}
                              <span className="text-xs text-base-dark/40">Wirt: {r.wirtStatus}</span>
                              {r.phase && <span className="text-xs text-base-dark/40">{r.phase}</span>}
                            </div>
                            <h3 className="font-bold text-base-dark">{r.vereinName || r.leadKey}</h3>
                            <p className="text-sm text-base-dark/60">{r.ort || "—"} · {r.vereinsTyp || "—"} · {r.jubileeYears ? r.jubileeYears + " Jahre" : ""}</p>
                            {r.scoreReason && <p className="text-xs text-base-dark/50 mt-1">{r.scoreReason}</p>}
                            {r.nextAction && <p className="text-xs text-base-dark/60 mt-1">Nächste Aktion: {r.nextAction}</p>}
                            {r.contactEmail && <p className="text-xs mt-1 text-base-dark/60">Kontakt: {r.contactName || ""} {r.contactEmail} {r.contactPhone || ""}</p>}
                            {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-green hover:underline break-all mt-1 inline-block">Quelle öffnen ↗</a>}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {["neu", "kontaktiert", "im_gespraech", "angebot", "gewonnen", "verloren", "vertagt"].map((s) => (
                              <form key={s} action={async () => { "use server"; await updateVereinsRadarWirt(r.id, s); }}>
                                <button type="submit" className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${r.wirtStatus === s ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark/60 border-border-light hover:border-accent-green"}`}>{s}</button>
                              </form>
                            ))}
                            <form action={async () => { "use server"; await deleteVereinsRadar(r.id); }}>
                              <button type="submit" title="Löschen" aria-label={`Eintrag löschen: ${r.vereinName || r.leadKey}`} className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition">
                                <span aria-hidden>🗑</span>
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}