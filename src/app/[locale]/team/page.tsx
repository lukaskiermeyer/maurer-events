import { Link } from "@/i18n/routing";
import { getMyProfile } from "@/app/actions/staff";
import { getMyOpenShifts } from "@/app/actions/staffing";

export const dynamic = "force-dynamic";

export default async function TeamDashboard() {
  const { member, role, documents, contracts } = await getMyProfile();
  const { offers } = await getMyOpenShifts().catch(() => ({ offers: [] }));
  const contract = contracts[0];
  const hasPersonalData = !!(member.street && member.city && member.birthDate);
  const hasPayrollData = member.hasTaxId && member.hasSocialSecurity && member.hasIban;
  const hasContract = !!contract;
  const signedContract = contract?.status === "signed" || contract?.status === "verified";
  const items = [
    { label: "Persönliche Daten", done: hasPersonalData, href: "/team/onboarding" },
    { label: "Lohn-/Steuerdaten", done: hasPayrollData, href: "/team/onboarding" },
    { label: "Dokumente", done: documents.length > 0, href: "/team/onboarding" },
    { label: "Vertrag", done: hasContract && signedContract, href: "/team/vertrag" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Mitarbeiterportal</p>
        <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Servus, {member.firstName}!</h1>
        <p className="text-base-dark/60 mt-1">{role?.name || "Mitarbeiter"} · Status: {member.status}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/team/onboarding" className="bg-white border border-border-light rounded-2xl p-5 hover:border-accent-green transition-colors">
          <h2 className="font-display font-bold text-xl mb-1">Onboarding</h2>
          <p className="text-sm text-base-dark/60">Stammdaten, Lohnangaben und Dokumente pflegen.</p>
        </Link>
        <Link href="/team/vertrag" className="bg-white border border-border-light rounded-2xl p-5 hover:border-accent-green transition-colors">
          <h2 className="font-display font-bold text-xl mb-1">Vertrag</h2>
          <p className="text-sm text-base-dark/60">{contract ? `Status: ${contract.status}` : "Noch kein Vertrag hinterlegt."}</p>
        </Link>
        <Link href="/team/profil" className="bg-white border border-border-light rounded-2xl p-5 hover:border-accent-green transition-colors">
            <h2 className="font-display font-bold text-xl mb-1">Profil</h2>
            <p className="text-sm text-base-dark/60">Eigene Daten bearbeiten.</p>
          </Link>
          <Link href="/team/verfuegbarkeit" className="bg-white border border-border-light rounded-2xl p-5 hover:border-accent-green transition-colors">
          <h2 className="font-display font-bold text-xl mb-1">Verfügbarkeit</h2>
          <p className="text-sm text-base-dark/60">Trage ein, wann du an den Festen kannst.</p>
        </Link>
        <Link href="/team/schichten" className="bg-white border border-border-light rounded-2xl p-5 hover:border-accent-green transition-colors">
          <h2 className="font-display font-bold text-xl mb-1">Schichten{offers.length > 0 ? ` (${offers.length} offen)` : ""}</h2>
          <p className="text-sm text-base-dark/60">{offers.length > 0 ? `${offers.length} offene Schicht${offers.length === 1 ? "" : "en"} – jetzt eintragen.` : "Vorgeschlagene Einsätze annehmen oder ablehnen."}</p>
        </Link>
      </div>

      <div className="bg-white border border-border-light rounded-2xl p-5">
        <h2 className="font-display font-bold text-xl mb-4">Checkliste</h2>
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <Link href={item.href} className="font-bold hover:text-accent-green">{item.label}</Link>
              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${item.done ? "bg-accent-green/10 text-accent-green" : "bg-amber-100 text-amber-800"}`}>
                {item.done ? "Erledigt" : "Offen"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-canvas-light border border-border-light rounded-2xl p-5 text-sm text-base-dark/60">
        Deine Daten werden vertraulich behandelt. Bei Fragen wende dich an den Festwirt.
      </div>
    </div>
  );
}