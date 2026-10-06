import { requireAdmin } from "@/lib/auth";
import ScannerClient from "./ScannerClient";

export default async function ScannerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const resolvedParams = await params;
  
  return <ScannerClient eventId={resolvedParams.id} />;
}
