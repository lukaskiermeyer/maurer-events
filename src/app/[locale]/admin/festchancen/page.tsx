import { requireAdmin } from "@/lib/auth";
import { getFestOpportunities, getFestRuns, triggerN8nWebhook, updateFestOpportunityStatus } from "@/app/actions/festchancen";
import StaffHeader from "@/components/admin/StaffHeader";
import { Link } from "@/i18n/routing";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function FestChancenPage() {
  await requireAdmin(true);
  const [opportunities, runs] = await Promise.all([getFestOpportunities(), getFestRuns()]);

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">
              &larr; Zurück zum Admin
            </Link>
            <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Fest-Chancen (n8n)</h1>
            <p className="mt-2 text-base-dark/60">Gefundene Vereinsjubiläen & Feste. Du entscheidest, ob wir uns bewerben.</p>
          </div>
          <form action={async () => { "use server"; await triggerN8nWebhook(); revalidatePath("/[locale]/admin/festchancen", "page"); }}>
            <button type="submit" className="min-h-12 inline-flex items-center px-5 rounded-xl bg-accent-green text-white font-bold hover:opacity-90">
              Jetzt in n8n suchen
            </button>
          </form>
        </div>

        {/* Runs */}
        {runs.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-2xl border border-border-light shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-2">Letzte Läufe</h2>
            <ul className="text-sm space-y-1">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-3">
                  <span className="font-mono text-xs">{r.runId}</span>
                  <span>{new Date(r.createdAt).toLocaleString("de-DE")}</span>
                  <span>gefunden: {r.foundCount}, gesynct: {r.syncedCount}</span>
                  {r.error && <span className="text-red-600">{r.error.slice(0, 120)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Opportunities */}
        {opportunities.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-border-light text-center text-base-dark/60">
            Noch keine Fest-Chancen. Starte eine Suche mit „Jetzt in n8n suchen".
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((o) => (
              <div key={o.id} className="bg-white p-5 rounded-2xl border border-border-light shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-black px-2 py-1 rounded-full ${o.score >= 80 ? "bg-green-100 text-green-800" : o.score >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"}`}>
                        Score {o.score}
                      </span>
                      <span className="text-xs uppercase font-bold opacity-50">{o.region || "—"}</span>
                      <span className="text-xs uppercase font-bold opacity-50">{o.status}</span>
                    </div>
                    <h3 className="text-lg font-bold text-base-dark">{o.title || "Ohne Titel"}</h3>
                    <p className="text-sm text-base-dark/60">{o.organizer || "—"} · {o.location || "—"} · {o.eventDate ? new Date(o.eventDate).toLocaleDateString("de-DE") : "Datum offen"}</p>
                    {o.scoreReason && <p className="text-xs text-base-dark/50 mt-1">{o.scoreReason}</p>}
                    {o.contactEmail && <p className="text-xs mt-1">Kontakt: {o.contactName || ""} {o.contactEmail} {o.contactPhone || ""}</p>}
                    {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-green hover:underline break-all">Quelle öffnen</a>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["new", "reviewing", "applied", "contacted", "won", "lost", "ignore"].map((s) => (
                      <form key={s} action={async () => { "use server"; await updateFestOpportunityStatus(o.id, s); }}>
                        <button type="submit" className={`text-xs px-2 py-1 rounded-lg border ${o.status === s ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark/70 border-border-light hover:border-accent-green"}`}>
                          {s}
                        </button>
                      </form>
                    ))}
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