import { requireAdmin } from "@/lib/auth";
import {
  getFestRuns,
  getFestChances,
  triggerN8nWebhook,
  updateFestChanceWirt,
  deleteFestChance,
  archiveExpiredFestChances,
  getVereinsRadar,
  updateVereinsRadarWirt,
  deleteVereinsRadar,
} from "@/app/actions/festchancen";
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

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDay(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(raw: string | null | undefined, todayStartMs: number): number | null {
  const d = parseIsoDay(raw);
  if (!d) return null;
  return Math.round((d.getTime() - todayStartMs) / DAY_MS);
}

function formatDeDate(raw: string | null | undefined): string {
  const d = parseIsoDay(raw);
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", { timeZone: "UTC" });
}

type FestChanceRow = Awaited<ReturnType<typeof getFestChances>>[number];
type VereinsRadarRow = Awaited<ReturnType<typeof getVereinsRadar>>[number];

function isExpiredChance(o: FestChanceRow, todayIso: string, currentYear: number): boolean {
  if (o.verificationStatus === "expired" || o.verificationStatus === "already_awarded") return true;
  if (o.applicationDeadline && o.applicationDeadline.slice(0, 10) < todayIso) return true;
  if (o.eventDate && o.eventDate.slice(0, 10) < todayIso) return true;
  if (!o.eventDate && o.eventYear != null && o.eventYear < currentYear) return true;
  return false;
}

function expiredReasonLabel(o: FestChanceRow, todayIso: string, currentYear: number): string {
  if (o.verificationStatus === "already_awarded") return "Bereits vergeben";
  if (o.verificationStatus === "expired") return "Als abgelaufen verifiziert";
  if (o.applicationDeadline && o.applicationDeadline.slice(0, 10) < todayIso) {
    return `Frist abgelaufen (${formatDeDate(o.applicationDeadline)})`;
  }
  if (o.eventDate && o.eventDate.slice(0, 10) < todayIso) {
    return `Fest vorbei (${formatDeDate(o.eventDate)})`;
  }
  if (!o.eventDate && o.eventYear != null && o.eventYear < currentYear) {
    return `Jahr ${o.eventYear} vorbei`;
  }
  return "Veraltet";
}

function ChanceCard({ o, todayStartMs, expiredLabel }: { o: FestChanceRow; todayStartMs: number; expiredLabel?: string }) {
  const deadlineDays = daysUntil(o.applicationDeadline, todayStartMs);
  const eventDateLabel = o.eventDate
    ? formatDeDate(o.eventDate)
    : o.eventYear
      ? `ca. ${o.eventYear}${o.dateAssumed ? " (geschätzt)" : ""}`
      : "Datum offen";

  const hasContact = Boolean(o.contactName || o.contactEmail || o.contactPhone);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 sm:p-5 ${expiredLabel ? "border-border-light/70 opacity-75" : "border-border-light"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                o.score >= 85
                  ? "bg-emerald-100 text-emerald-800"
                  : o.score >= 60
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              Score {o.score}
            </span>
            {o.verificationStatus === "verified" ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Verifiziert
              </span>
            ) : expiredLabel ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                {expiredLabel}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-base-dark/50">
                Ungeprüft
              </span>
            )}
            {o.emergency && (
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                NOTFALL
              </span>
            )}
            {o.applicationDeadline && deadlineDays !== null && deadlineDays >= 0 && (
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  deadlineDays <= 14
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-50 text-blue-800"
                }`}
              >
                ⏳ Frist: {formatDeDate(o.applicationDeadline)} ({deadlineDays === 0 ? "heute!" : `in ${deadlineDays} Tagen`})
              </span>
            )}
            {o.jubileeYears && (
              <span className="text-xs font-bold text-accent-wood">{o.jubileeYears} Jahre</span>
            )}
            {o.region && (
              <span className="text-xs font-bold uppercase text-base-dark/40">{o.region}</span>
            )}
            {o.sourceDate && (
              <span className="text-xs text-base-dark/40">Quelle: {formatDeDate(o.sourceDate)}</span>
            )}
          </div>

          <h3 className="font-bold text-base-dark text-base sm:text-lg leading-snug">
            {o.title || o.sourceUrl}
          </h3>
          <p className="text-sm text-base-dark/65 mt-0.5">
            {o.organizer || "—"} · {o.location || "—"} · {eventDateLabel}
            {o.monthsAhead != null && o.monthsAhead >= 0 ? ` (in ca. ${o.monthsAhead} Mon.)` : ""}
          </p>

          {o.verificationSummary && (
            <p className="text-xs text-emerald-900 bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-3 py-1.5 mt-2">
              <b>Nachrecherche:</b> {o.verificationSummary}
            </p>
          )}

          {(o.incumbentFestwirt || o.brauereiPartner) && (
            <p className="text-xs text-amber-900 mt-1.5">
              Bisheriger Wirt/Bräu: {[o.incumbentFestwirt, o.brauereiPartner].filter(Boolean).join(" · ")}
            </p>
          )}

          {hasContact && (
            <p className="text-xs text-base-dark/65 mt-1.5">
              Kontakt:{" "}
              {[
                o.contactRole ? `${o.contactRole} ` : "",
                o.contactName || "",
              ]
                .join("")
                .trim() || "Ansprechpartner"}
              {o.contactEmail ? ` · ${o.contactEmail}` : ""}
              {o.contactPhone ? ` · ${o.contactPhone}` : ""}
            </p>
          )}

          {o.scoreReason && <p className="text-xs text-base-dark/45 mt-1">{o.scoreReason}</p>}
          {o.sourceUrl && (
            <a
              href={o.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-accent-green hover:underline break-all mt-1.5 inline-block"
            >
              Quelle öffnen ↗
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ChanceStatusSelect
            value={o.wirtStatus}
            options={WIRT_STATUS_OPTIONS}
            action={updateFestChanceWirt.bind(null, o.id)}
            label={`Status für ${o.title || "Chance"}`}
          />
          <form
            action={async () => {
              "use server";
              await deleteFestChance(o.id);
            }}
          >
            <button
              type="submit"
              title="Löschen – wird bei künftigen Suchläufen übersprungen"
              aria-label={`Chance löschen: ${o.title || o.sourceUrl}`}
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition"
            >
              <span aria-hidden>🗑</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function RadarCard({ r, todayStartMs }: { r: VereinsRadarRow; todayStartMs: number }) {
  const visitDays = daysUntil(r.nextVisitDate, todayStartMs);
  const hasFutureVisit = Boolean(r.nextVisitEvent && (visitDays === null || visitDays >= 0));
  const hasContact = Boolean(r.contactName || r.contactEmail || r.contactPhone);

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                r.score >= 80
                  ? "bg-emerald-100 text-emerald-800"
                  : r.score >= 60
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              Score {r.score}
            </span>
            {r.verifiedAt && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Nachrecherchiert
              </span>
            )}
            {r.eventYear && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-accent-wood/15 text-base-dark">
                🎉 {r.jubileeYears ? `${r.jubileeYears} Jahre ` : "Jubiläum "}
                {r.eventYear}
                {r.monthsAhead != null && r.monthsAhead >= 0 ? ` · in ${r.monthsAhead} Mon.` : ""}
              </span>
            )}
            {r.region && (
              <span className="text-xs font-bold uppercase text-base-dark/40">{r.region}</span>
            )}
          </div>

          <h3 className="font-bold text-base-dark text-base sm:text-lg leading-snug">
            {r.vereinName || r.leadKey}
          </h3>
          <p className="text-sm text-base-dark/65 mt-0.5">
            {r.ort || "—"} · {r.vereinsTyp || "Verein"}
            {r.foundingYear ? ` · gegr. ${r.foundingYear}` : ""}
            {r.mitglieder ? ` · ca. ${r.mitglieder} Mitgl.` : ""}
          </p>

          {hasFutureVisit && (
            <div className="mt-2 rounded-xl bg-amber-50/90 border border-amber-200 px-3 py-2 text-xs text-amber-950">
              <span className="font-bold">🍻 Besuchs-Anlass zum Vorbeischauen:</span>{" "}
              {r.nextVisitEvent}
              {r.nextVisitDate && (
                <>
                  {" "}
                  · <b>{formatDeDate(r.nextVisitDate)}</b>
                  {visitDays !== null && visitDays >= 0 ? ` (in ${visitDays} Tagen)` : ""}
                </>
              )}
              {r.nextVisitUrl && (
                <>
                  {" "}
                  <a
                    href={r.nextVisitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-green font-semibold hover:underline"
                  >
                    Termine ↗
                  </a>
                </>
              )}
            </div>
          )}

          {r.verificationSummary && (
            <p className="text-xs text-emerald-900 bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-3 py-1.5 mt-2">
              <b>Recherche:</b> {r.verificationSummary}
            </p>
          )}

          {(r.tentHistory || r.incumbentFestwirt || r.brauereiPartner) && (
            <p className="text-xs text-base-dark/65 mt-1.5">
              {r.tentHistory ? `Festzelt-Historie: ${r.tentHistory}` : ""}
              {r.tentHistory && (r.incumbentFestwirt || r.brauereiPartner) ? " · " : ""}
              {(r.incumbentFestwirt || r.brauereiPartner)
                ? `Bisheriger Wirt/Bräu: ${[r.incumbentFestwirt, r.brauereiPartner].filter(Boolean).join(" / ")}`
                : ""}
            </p>
          )}

          {r.nextAction && (
            <p className="text-xs text-base-dark/70 mt-1.5">
              <b>Nächster Schritt:</b> {r.nextAction}
            </p>
          )}

          {hasContact && (
            <p className="text-xs mt-1 text-base-dark/65">
              Kontakt:{" "}
              {[r.contactRole ? `${r.contactRole} ` : "", r.contactName || ""].join("").trim()}
              {r.contactEmail ? ` · ${r.contactEmail}` : ""}
              {r.contactPhone ? ` · ${r.contactPhone}` : ""}
            </p>
          )}

          {r.scoreReason && <p className="text-xs text-base-dark/45 mt-1">{r.scoreReason}</p>}
          {r.sourceUrl && (
            <a
              href={r.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-accent-green hover:underline break-all mt-1.5 inline-block"
            >
              Vereinsseite öffnen ↗
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ChanceStatusSelect
            value={r.wirtStatus}
            options={WIRT_STATUS_OPTIONS}
            action={updateVereinsRadarWirt.bind(null, r.id)}
            label={`Status für ${r.vereinName || r.leadKey}`}
          />
          <form
            action={async () => {
              "use server";
              await deleteVereinsRadar(r.id);
            }}
          >
            <button
              type="submit"
              title="Löschen – wird bei künftigen Radar-Läufen übersprungen"
              aria-label={`Eintrag löschen: ${r.vereinName || r.leadKey}`}
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100 transition"
            >
              <span aria-hidden>🗑</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default async function FestChancenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin(true);
  const params = await searchParams;
  const activeTab = params?.tab === "verein" ? "verein" : "fest";

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const todayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentYear = now.getUTCFullYear();
  const todayDe = now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

  const [runs, allChances, allRadar] = await Promise.all([
    getFestRuns(),
    getFestChances(),
    getVereinsRadar(),
  ]);

  // Dynamische Trennung gegen heutiges Datum: aktive vs. abgelaufene Chancen
  const activeChances = allChances.filter((o) => !isExpiredChance(o, todayIso, currentYear));
  const expiredChances = allChances.filter((o) => isExpiredChance(o, todayIso, currentYear));

  // Sortierung: Verifiziert zuerst, dann dringendste offene Frist, dann Score
  const sortActiveChances = (list: FestChanceRow[]) =>
    list.slice().sort((a, b) => {
      const av = a.verificationStatus === "verified" ? 1 : 0;
      const bv = b.verificationStatus === "verified" ? 1 : 0;
      if (av !== bv) return bv - av;
      const ad = daysUntil(a.applicationDeadline, todayStartMs);
      const bd = daysUntil(b.applicationDeadline, todayStartMs);
      if (ad !== null && bd !== null && ad !== bd) return ad - bd;
      if (ad !== null && bd === null) return -1;
      if (ad === null && bd !== null) return 1;
      return b.score - a.score;
    });

  const openLeads = sortActiveChances(activeChances.filter((o) => o.leadType === "open"));
  const signalLeads = sortActiveChances(activeChances.filter((o) => o.leadType === "signal"));
  const watchLeads = sortActiveChances(activeChances.filter((o) => o.leadType === "watch"));

  // Vereins-Radar: dynamisch nach aktuellem Vorlauf (monthsAhead) einsortieren
  const activeRadar = allRadar.filter((r) => r.monthsAhead == null || r.monthsAhead >= 0);
  const pastRadar = allRadar.filter((r) => r.monthsAhead != null && r.monthsAhead < 0);

  const sortRadar = (list: VereinsRadarRow[]) =>
    list.slice().sort((a, b) => {
      const aVisit = daysUntil(a.nextVisitDate, todayStartMs);
      const bVisit = daysUntil(b.nextVisitDate, todayStartMs);
      const aHas = aVisit !== null && aVisit >= 0;
      const bHas = bVisit !== null && bVisit >= 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas && aVisit !== bVisit) return (aVisit as number) - (bVisit as number);
      return b.score - a.score;
    });

  const vereinConnecten = sortRadar(
    activeRadar.filter((r) =>
      r.monthsAhead != null ? r.monthsAhead >= 18 && r.monthsAhead <= 42 : r.status === "connecten",
    ),
  );
  const vereinJetzt = sortRadar(
    activeRadar.filter((r) =>
      r.monthsAhead != null ? r.monthsAhead >= 0 && r.monthsAhead < 18 : r.status === "jetzt_anbieten",
    ),
  );
  const vereinBeobachten = sortRadar(
    activeRadar.filter((r) =>
      r.monthsAhead != null ? r.monthsAhead > 42 : r.status === "beobachten",
    ),
  );

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        {/* Tab Navigation */}
        <div className="grid grid-cols-2 bg-white p-1 rounded-xl border border-border-light shadow-sm w-full sm:w-fit mb-6">
          <Link
            href="/admin/festchancen"
            className={`px-3 sm:px-6 min-h-12 flex items-center justify-center rounded-lg font-bold text-sm transition-all duration-200 text-center ${
              activeTab === "fest"
                ? "bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20"
                : "text-base-dark/50 hover:text-base-dark hover:bg-base-light"
            }`}
          >
            Fest-Chancen ({activeChances.length})
          </Link>
          <Link
            href="/admin/festchancen?tab=verein"
            className={`px-3 sm:px-6 min-h-12 flex items-center justify-center rounded-lg font-bold text-sm transition-all duration-200 text-center ${
              activeTab === "verein"
                ? "bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20"
                : "text-base-dark/50 hover:text-base-dark hover:bg-base-light"
            }`}
          >
            Vereins-Radar ({activeRadar.length})
          </Link>
        </div>

        {activeTab === "fest" && (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-green/10 via-white to-accent-wood/10 border border-border-light p-6 sm:p-8 mb-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link
                    href="/admin"
                    className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block"
                  >
                    &larr; Zurück zum Admin
                  </Link>
                  <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">
                    Fest-Chancen
                  </h1>
                  <p className="mt-2 text-base-dark/65">
                    Verifizierte Ausschreibungen &amp; frühe Signale aus n8n. Stand:{" "}
                    <b>{todayDe}</b> – abgelaufene Fristen und vergangene Feste werden automatisch ausgefiltert.
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await triggerN8nWebhook("fest");
                    revalidatePath("/[locale]/admin/festchancen", "page");
                  }}
                >
                  <button
                    type="submit"
                    className="min-h-12 inline-flex items-center gap-2 px-6 rounded-xl bg-accent-green text-white font-bold shadow-lg shadow-accent-green/25 hover:opacity-90 transition"
                  >
                    <span aria-hidden>🔍</span> Fest-Chancen suchen
                  </button>
                </form>
              </div>
            </div>

            {runs.length > 0 && (
              <div className="mb-6 bg-white p-4 rounded-2xl border border-border-light shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-widest text-base-dark/50 mb-2">
                  Letzte Suchläufe
                </h2>
                <ul className="text-sm space-y-2">
                  {runs.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 text-base-dark/70">
                      <span className="font-mono text-xs bg-base-light px-2 py-0.5 rounded-md">
                        {r.runId}
                      </span>
                      <span>{new Date(r.createdAt).toLocaleString("de-DE")}</span>
                      <span className="text-xs">
                        verifiziert: <b>{r.foundCount}</b>, übernommen: <b>{r.syncedCount}</b>
                      </span>
                      {r.error && (
                        <span className="text-red-600 text-xs">{r.error.slice(0, 120)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-xl font-display font-bold text-base-dark mb-1">
                🔥 Aktive Ausschreibungen ({openLeads.length})
              </h2>
              <p className="text-sm text-base-dark/50 mb-3">
                Offene Festwirt-Gesuche mit gültiger Bewerbungsfrist, nach Verifizierung &amp; Dringlichkeit sortiert.
              </p>
              {openLeads.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">
                  Aktuell keine offenen Ausschreibungen. Starte eine Suche über „Fest-Chancen suchen“.
                </div>
              ) : (
                <div className="space-y-3">
                  {openLeads.map((o) => (
                    <ChanceCard key={o.id} o={o} todayStartMs={todayStartMs} />
                  ))}
                </div>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-display font-bold text-base-dark mb-1">
                📡 Frühe Signale &amp; Festausschuss ({signalLeads.length})
              </h2>
              <p className="text-sm text-base-dark/50 mb-3">
                Angekündigte Feste, bei denen noch kein Festwirt feststeht – ideal zum frühzeitigen Vorstellen.
              </p>
              {signalLeads.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">
                  Keine frühen Signale vorhanden.
                </div>
              ) : (
                <div className="space-y-3">
                  {signalLeads.map((o) => (
                    <ChanceCard key={o.id} o={o} todayStartMs={todayStartMs} />
                  ))}
                </div>
              )}
            </div>

            {watchLeads.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-display font-bold text-base-dark mb-3">
                  👁 Watchlist ({watchLeads.length})
                </h2>
                <div className="space-y-3">
                  {watchLeads.map((o) => (
                    <ChanceCard key={o.id} o={o} todayStartMs={todayStartMs} />
                  ))}
                </div>
              </div>
            )}

            {expiredChances.length > 0 && (
              <details className="bg-white rounded-2xl border border-border-light p-4 sm:p-5">
                <summary className="cursor-pointer font-bold text-sm text-base-dark/65 flex flex-wrap items-center justify-between gap-3">
                  <span>
                    📦 Abgelaufene / vergangene Einträge ({expiredChances.length}) – automatisch ausgeblendet
                  </span>
                </summary>
                <div className="mt-4">
                  <div className="mb-4 flex justify-end">
                    <form
                      action={async () => {
                        "use server";
                        await archiveExpiredFestChances();
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs font-bold px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                      >
                        Alle {expiredChances.length} abgelaufenen Einträge endgültig aufräumen
                      </button>
                    </form>
                  </div>
                  <div className="space-y-3">
                    {expiredChances.map((o) => (
                      <ChanceCard
                        key={o.id}
                        o={o}
                        todayStartMs={todayStartMs}
                        expiredLabel={expiredReasonLabel(o, todayIso, currentYear)}
                      />
                    ))}
                  </div>
                </div>
              </details>
            )}
          </>
        )}

        {activeTab === "verein" && (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-green/10 via-white to-accent-wood/10 border border-border-light p-6 sm:p-8 mb-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link
                    href="/admin"
                    className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block"
                  >
                    &larr; Zurück zum Admin
                  </Link>
                  <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">
                    Vereins-Radar
                  </h1>
                  <p className="mt-2 text-base-dark/65">
                    Frühwarnsystem über Gründungsjahre (<b>18–42 Monate Vorlauf</b>) inkl. nächstem Vereinsfest zum persönlichen Vorbeischauen – bevor überhaupt ausgeschrieben wird. Stand: <b>{todayDe}</b>.
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await triggerN8nWebhook("radar");
                    revalidatePath("/[locale]/admin/festchancen", "page");
                  }}
                >
                  <button
                    type="submit"
                    className="min-h-12 inline-flex items-center gap-2 px-6 rounded-xl bg-accent-green text-white font-bold shadow-lg shadow-accent-green/25 hover:opacity-90 transition"
                  >
                    <span aria-hidden>🎯</span> Vereins-Radar starten
                  </button>
                </form>
              </div>
            </div>

            {[
              {
                title: "🎯 Jetzt Connecten – 18 bis 42 Monate vor Jubiläum",
                subtitle: "Ideal, um bei der nächsten Vereinsveranstaltung vorbeizuschauen und den Vorstand kennenzulernen.",
                items: vereinConnecten,
              },
              {
                title: "⚡ Jetzt konkret anbieten – unter 18 Monate",
                subtitle: "Jubiläum rückt näher – direkt anfragen, ob der Festwirt noch offen ist.",
                items: vereinJetzt,
              },
              {
                title: "👁 Beobachten – über 42 Monate entfernt",
                subtitle: "Vorgemerkt für die nächste Saison.",
                items: vereinBeobachten,
              },
            ].map(({ title, subtitle, items }) => (
              <div key={title} className="mb-8">
                <h2 className="text-xl font-display font-bold text-base-dark mb-1">
                  {title} ({items.length})
                </h2>
                <p className="text-sm text-base-dark/50 mb-3">{subtitle}</p>
                {items.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-border-light text-center text-base-dark/50 text-sm">
                    Keine Einträge in dieser Phase.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((r) => (
                      <RadarCard key={r.id} r={r} todayStartMs={todayStartMs} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {pastRadar.length > 0 && (
              <details className="bg-white rounded-2xl border border-border-light p-4 sm:p-5">
                <summary className="cursor-pointer font-bold text-sm text-base-dark/65">
                  📦 Vergangene Jubiläen ({pastRadar.length})
                </summary>
                <div className="space-y-3 mt-4 opacity-75">
                  {pastRadar.map((r) => (
                    <RadarCard key={r.id} r={r} todayStartMs={todayStartMs} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
