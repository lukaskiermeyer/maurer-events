import { requireAdmin } from "@/lib/auth";
import { getStaffingOverview } from "@/app/actions/staffing";
import StaffingOverview from "./StaffingOverview";

export const dynamic = "force-dynamic";

export default async function PersonalOverviewPage() {
  await requireAdmin(true);
  const data = await getStaffingOverview();
  return <StaffingOverview data={data} />;
}
