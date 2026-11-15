import { requireAdmin } from "@/lib/auth";
import { getStaffingOverview } from "@/app/actions/staffing";
import StaffHeader from "@/components/admin/StaffHeader";
import StaffingOverview from "./StaffingOverview";

export const dynamic = "force-dynamic";

export default async function PersonalOverviewPage() {
  await requireAdmin(true);
  const data = await getStaffingOverview();
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <StaffingOverview data={data} />
      </div>
    </div>
  );
}
