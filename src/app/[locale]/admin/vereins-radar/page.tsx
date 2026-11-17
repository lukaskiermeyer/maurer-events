import { requireAdmin } from "@/lib/auth";
import { getVereinsRadar, updateVereinsRadarWirt } from "@/app/actions/festchancen";
import StaffHeader from "@/components/admin/StaffHeader";
import { Link } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function VereinsRadarPage() {
  await requireAdmin(true);
  const [connecten, jetzt, beobachten] = await Promise.all([
    getVereinsRadar("connecten"),
    getVereinsRadar("jetzt_anbieten"),
    getVereinsRadar("beobachten"),
  ]);

  const renderList = (items: Awaited<ReturnType<typeof getVereinsRadar>>, title: string) => (
    <div className="mb-8">
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
                <div className="flex flex-wrap gap-1.5">
                  {["neu", "kontaktiert", "im_gespraech", "angebot", "gewonnen", "verloren", "vertagt"].map((s) => (
                    <form key={s} action={async () => { "use server"; await updateVereinsRadarWirt(r.id, s); }}>
                      <button type="submit" className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${r.wirtStatus === s ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark/60 border-border-light hover:border-accent-green"}`}>{s}</button>
                    </form>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">&larr; Zurück zum Admin</Link>
            <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Vereins-Radar</h1>
            <p className="mt-2 text-base-dark/60">Radar-Leads aus n8n. Status: connecten / jetzt anbieten / beobachten.</p>
          </div>
        </div>
        {renderList(connecten, "🎯 Radar (connecten)")}
        {renderList(jetzt, "⚡ Jetzt anbieten")}
        {renderList(beobachten, "👁 Beobachten")}
      </div>
    </div>
  );
}