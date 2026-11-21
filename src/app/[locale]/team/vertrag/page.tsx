import { Link } from "@/i18n/routing";
import { getMyContract } from "@/app/actions/staff";
import { wrapContractPaper } from "@/lib/contract-paper";
import ContractSign from "./ContractSign";
import PrintButton from "./PrintButton";
import OrtInput from "./OrtInput";

export const dynamic = "force-dynamic";

export default async function ContractPage() {
  const { role, contract, missingDocs } = await getMyContract();
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
  // Unterschriftsfelder als zwei nebeneinander liegende Kästen (Arbeitgeber | Arbeitnehmer)
  // mit Live-Vorschau der gezeichneten Unterschrift im rechten Kasten.
  const combinedSigRegex = /Unterschrift Arbeitgeber:\s*_{2,}[\s\S]*?Unterschrift Arbeitnehmer:\s*_{2,}/i;
  let paperHtml = contract.bodyHtml
    .replace(/\{\{#if\s+[a-zA-Z0-9_]+\s*\}\}/gi, "")
    .replace(/\{\{\/if\}\}/gi, "")
    .replace(/\{\{#unless\s+[a-zA-Z0-9_]+\s*\}\}/gi, "")
    .replace(/\{\{\/unless\}\}/gi, "");
  if (combinedSigRegex.test(paperHtml)) {
    paperHtml = paperHtml.replace(
      combinedSigRegex,
      '<div style="display:flex;gap:1.5rem;margin-top:1.5rem;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:200px;">' +
          '<div style="border:1px solid #d1d5db;border-radius:0.5rem;height:5rem;margin-bottom:0.5rem;position:relative;overflow:hidden;" id="sig-employer-line"></div>' +
          '<div style="text-align:center;font-size:0.75rem;color:#666;">Unterschrift Arbeitgeber</div>' +
        '</div>' +
        '<div style="flex:1;min-width:200px;">' +
          '<div style="border:1px solid #d1d5db;border-radius:0.5rem;height:5rem;margin-bottom:0.5rem;position:relative;overflow:hidden;" id="sig-employee-line"></div>' +
          '<div style="text-align:center;font-size:0.75rem;color:#666;">Unterschrift Arbeitnehmer</div>' +
        '</div>' +
      '</div>'
    );
  } else {
    paperHtml = paperHtml
      .replace(/Unterschrift Arbeitgeber:\s*_{2,}/gi, '<div style="border:1px solid #d1d5db;border-radius:0.5rem;height:5rem;margin-bottom:0.5rem;" id="sig-employer-line"></div><div style="font-size:0.75rem;color:#666;text-align:center;margin-bottom:1rem;">Unterschrift Arbeitgeber</div>')
      .replace(/Unterschrift Arbeitnehmer:\s*_{2,}/gi, '<div style="border:1px solid #d1d5db;border-radius:0.5rem;height:5rem;margin-bottom:0.5rem;" id="sig-employee-line"></div><div style="font-size:0.75rem;color:#666;text-align:center;margin-bottom:1rem;">Unterschrift Arbeitnehmer</div>');
  }

  const ortMatch = contract.bodyHtml.match(/<span style="display:inline-block;border-bottom:1px solid #000;min-width:120px">([^<]*)<\/span>/);
  const initialOrt = ortMatch ? ortMatch[1].replace(/&nbsp;/g, "").trim() : "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Vertrag</p>
        <h1 className="text-3xl font-display font-black text-base-dark">{role?.name || "Mitarbeiter"} · Version {contract.templateVersion}</h1>
        <p className="text-base-dark/60 mt-1">Status: {contract.status} · Unterschrift: {contract.signatureMode === "handwritten" ? "handschriftlich" : "digital"}</p>
      </div>

      <div className="contract-document contract-paper bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 max-w-[210mm] mx-auto">
        <div
          className="text-sm sm:text-base"
          dangerouslySetInnerHTML={{ __html: wrapContractPaper(paperHtml) }}
        />
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-base-dark text-white px-5 py-3 rounded-xl font-bold">PDF öffnen / herunterladen</a>
        <PrintButton />
      </div>

      {contract.status === "pending" && (
        <OrtInput contractId={contract.id} initialOrt={initialOrt} />
      )}

      <ContractSign
        contractId={contract.id}
        signatureMode={contract.signatureMode as "text" | "handwritten"}
        status={contract.status}
        signedFileUrl={contract.signedFileUrl}
        missingDocs={missingDocs}
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