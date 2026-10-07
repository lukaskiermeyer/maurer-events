import { requireScanner } from "@/lib/auth";
import AdminScanClient from "./ScanClient";

export default async function AdminScanPage() {
  const staff = await requireScanner(undefined, true);
  
  return <AdminScanClient scannerOnly={staff.role === 'scanner'} />;
}
