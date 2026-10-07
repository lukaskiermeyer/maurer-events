import { requireScanner } from "@/lib/auth";
import ScannerClient from "./ScannerClient";

export default async function ScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const staff = await requireScanner(resolvedParams.id, true);
  
  return <ScannerClient eventId={resolvedParams.id} scannerOnly={staff.role === 'scanner'} />;
}
