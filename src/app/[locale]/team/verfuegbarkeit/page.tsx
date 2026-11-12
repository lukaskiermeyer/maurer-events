import { getMyStaffing } from "@/app/actions/staffing";
import AvailabilityForm from "./AvailabilityForm";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const { upcoming, availability } = await getMyStaffing();
  return <AvailabilityForm events={upcoming} initialAvailability={availability} />;
}