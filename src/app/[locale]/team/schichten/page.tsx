import { getMyStaffing } from "@/app/actions/staffing";
import ShiftsList from "./ShiftsList";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const { upcoming, assignments, roles } = await getMyStaffing();
  return <ShiftsList events={upcoming} roles={roles} initialAssignments={assignments} />;
}