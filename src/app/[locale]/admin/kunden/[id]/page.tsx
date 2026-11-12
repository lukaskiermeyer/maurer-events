import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCustomer } from "@/app/actions/customers";
import { getAllEvents } from "@/app/actions/events";
import { getTables } from "@/app/actions/tables";
import StaffHeader from "@/components/admin/StaffHeader";
import CustomerDetail from "./CustomerDetail";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const { id } = await params;
  const result = await getCustomer(id);
  if (!result) notFound();
  const [events, tables] = await Promise.all([getAllEvents(), getTables()]);
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <CustomerDetail customer={result.customer} history={result.history} events={events} tables={tables} />
      </div>
    </div>
  );
}