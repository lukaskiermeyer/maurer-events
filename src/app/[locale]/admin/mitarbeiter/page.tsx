import { requireAdmin } from "@/lib/auth";
import { getStaffList, getRoles, getContractTemplates } from "@/app/actions/staff";
import { getDocumentTemplates } from "@/app/actions/document-templates";
import StaffHeader from "@/components/admin/StaffHeader";
import StaffAdmin from "./StaffAdmin";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requireAdmin(true);
  const [staff, roles, templates, documentTemplates] = await Promise.all([getStaffList(), getRoles(), getContractTemplates(), getDocumentTemplates()]);
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <StaffAdmin initialStaff={staff} initialRoles={roles} initialTemplates={templates} initialDocumentTemplates={documentTemplates} />
      </div>
    </div>
  );
}