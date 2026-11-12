import sanitizeHtml from "sanitize-html";
import { Link } from "@/i18n/routing";
import { getMyContract } from "@/app/actions/staff";
import ContractSign from "./ContractSign";

export const dynamic = "force-dynamic";

export default async function ContractPage() {
  const { member, role, contract } = await getMyContract();
  if (!contract) {
    return (
      <div className="bg-white border border-border-light rounded-2xl p-8 text-center">
        <h1 className="font-display font-black text-2xl mb-2">Noch kein Vertrag</h1>
        <p className="text-base-dark/60 mb-5">Für deine Rolle ist noch keine aktive Vertragsvorlage hinterlegt. Bitte wende dich an den Festwirt.</p>
        <Link href="/team" className="inline-block bg-accent-green text-white px-5 py-3 rounded-xl font-bold">Zurück zum Portal</Link>
      </div>
    );
  }
  const safeBody = sanitizeHtml(contract.bodyHtml, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "h4", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "a", "hr"],
    allowedAttributes: { a: ["href", "target", "rel"] },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Vertrag</p>
        <h1 className="text-3xl font-display font-black text-base-dark">{role?.name || "Mitarbeiter"} · Version {contract.templateVersion}</h1>
        <p className="text-base-dark/60 mt-1">Status: {contract.status} · Unterschrift: {contract.signatureMode === "handwritten" ? "handschriftlich" : "digital"}</p>
      </div>

      <article className="contract-document bg-white border border-border-light rounded-2xl p-6 sm:p-10 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: safeBody }} />

      <ContractSign
        contractId={contract.id}
        signatureMode={contract.signatureMode as "text" | "handwritten"}
        status={contract.status}
        signedFileUrl={contract.signedFileUrl}
        memberName={`${member.firstName} ${member.lastName}`}
      />

      <style>{`
        @page { size: A4 portrait; margin: 18mm; }
        @media print {
          html, body { background: #fff !important; }
          header, .no-print { display: none !important; }
          .contract-document { border: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}