import { requireAdmin } from "@/lib/auth";
import { getAdminUsers } from "@/app/actions/adminUsers";
import StaffHeader from "@/components/admin/StaffHeader";
import AdminUsersAdmin from "./AdminUsersAdmin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin(true);
  const users = await getAdminUsers();
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <AdminUsersAdmin initialUsers={users} />
      </div>
    </div>
  );
}