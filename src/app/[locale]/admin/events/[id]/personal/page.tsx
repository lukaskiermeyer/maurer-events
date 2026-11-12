import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStaffingData } from "@/app/actions/staffing";
import StaffHeader from "@/components/admin/StaffHeader";
import StaffingAdmin from "./StaffingAdmin";

export const dynamic = "force-dynamic";

export default async function StaffingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const { id } = await params;
  let data;
  try {
    data = await getStaffingData(id);
  } catch {
    notFound();
  }
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <StaffingAdmin data={data} />
      </div>
    </div>
  );
}