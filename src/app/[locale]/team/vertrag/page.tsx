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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Vertrag</p>
        <h1 className="text-3xl font-display font-black text-base-dark">{role?.name || "Mitarbeiter"} · Version {contract.templateVersion}</h1>
        <p className="text-base-dark/60 mt-1">Status: {contract.status} · Unterschrift: handschriftlich</p>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <iframe src={pdfUrl} title="Vertrag (PDF)" className="w-full h-[70vh] min-h-[480px]" />
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
          .contract-document { border: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}