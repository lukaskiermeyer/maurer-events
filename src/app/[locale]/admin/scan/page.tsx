import { requireAdmin } from "@/lib/auth";
import AdminScanClient from "./ScanClient";

export default async function AdminScanPage() {
  await requireAdmin(true);
  
  return <AdminScanClient />;
}
