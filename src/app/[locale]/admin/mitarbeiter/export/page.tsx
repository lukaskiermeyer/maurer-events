import { requireAdmin } from "@/lib/auth";
import { getPayrollStatus } from "@/app/actions/payroll";
import StaffHeader from "@/components/admin/StaffHeader";
import PayrollExportClient from "./PayrollExportClient";

export const dynamic = "force-dynamic";

export default async function PayrollExportPage() {
  await requireAdmin(true);
  const rows = await getPayrollStatus();
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <PayrollExportClient rows={rows} />
      </div>
    </div>
  );
}