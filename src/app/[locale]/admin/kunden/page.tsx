import { requireAdmin } from "@/lib/auth";
import { getCustomers } from "@/app/actions/customers";
import StaffHeader from "@/components/admin/StaffHeader";
import CustomerAdmin from "./CustomerAdmin";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireAdmin(true);
  const customers = await getCustomers();
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <CustomerAdmin initialCustomers={customers} />
      </div>
    </div>
  );
}