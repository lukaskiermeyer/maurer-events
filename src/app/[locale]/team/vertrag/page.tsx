import { Link } from "@/i18n/routing";
import { getMyContract } from "@/app/actions/staff";
import ContractSign from "./ContractSign";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ContractPage() {
  const { role, contract } = await getMyContract();
  if (!contract) {
    return (
      <div className="bg-white border border-border-light rounded-2xl p-8 text-center">
        <h1 className="font-display font-black text-2xl mb-2">Noch kein Vertrag</h1>
        <p className="text-base-dark/60 mb-5">Für deine Rolle ist noch keine aktive Vertragsvorlage hinterlegt. Bitte wende dich an den Festwirt.</p>
        <Link href="/team" className="inline-block bg-accent-green text-white px-5 py-3 rounded-xl font-bold">Zurück zum Portal</Link>
      </div>
    );
  }
  const pdfUrl = `/api/team/contract/pdf?contractId=${contract.id}`;

  // Bestehende Verträge (vor Einführung der Conditional-Logik) können die
  // Marker {{#if ...}} / {{/if}} noch als Klartext enthalten – diese entfernen,
  // damit der Vertrag wie ein sauberes Papier aussieht.
  const cleanBodyHtml = contract.bodyHtml
    .replace(/\{\{#if\s+[a-zA-Z0-9_]+\s*\}\}/gi, "")
    .replace(/\{\{\/if\}\}/gi, "")
    .replace(/\{\{#unless\s+[a-zA-Z0-9_]+\s*\}\}/gi, "")
    .replace(/\{\{\/unless\}\}/gi, "");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Vertrag</p>
        <h1 className="text-3xl font-display font-black text-base-dark">{role?.name || "Mitarbeiter"} · Version {contract.templateVersion}</h1>
        <p className="text-base-dark/60 mt-1">Status: {contract.status} · Unterschrift: {contract.signatureMode === "handwritten" ? "handschriftlich" : "digital"}</p>
      </div>

      <div className="contract-document bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 max-w-[210mm] mx-auto">
        <div
          className="text-sm sm:text-base leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_br]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: cleanBodyHtml }}
        />
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-base-dark text-white px-5 py-3 rounded-xl font-bold">PDF öffnen / herunterladen</a>
        <PrintButton />
      </div>

      <ContractSign
        contractId={contract.id}
        signatureMode={contract.signatureMode as "text" | "handwritten"}
        status={contract.status}
        signedFileUrl={contract.signedFileUrl}
      />

      <style>{`
        @page { size: A4 portrait; margin: 18mm; }
        @media print {
          html, body { background: #fff !important; }
          header, .no-print { display: none !important; }
          .contract-document { border: 0 !important; box-shadow: none !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}