import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStaffDetail, getRoles } from "@/app/actions/staff";
import StaffHeader from "@/components/admin/StaffHeader";
import StaffDetailAdmin from "./StaffDetailAdmin";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const { id } = await params;
  const [detail, roles] = await Promise.all([getStaffDetail(id), getRoles()]);
  if (!detail) notFound();
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1100px] mx-auto px-4 pt-6">
        <StaffDetailAdmin detail={detail} roles={roles} />
      </div>
    </div>
  );
}