import { requireAdmin } from "@/lib/auth";
import { getPayrollStatus } from "@/app/actions/payroll";
import { getAllEvents } from "@/app/actions/events";
import StaffHeader from "@/components/admin/StaffHeader";
import PayrollExportClient from "./PayrollExportClient";

export const dynamic = "force-dynamic";

export default async function PayrollExportPage() {
  await requireAdmin(true);
  const [rows, events] = await Promise.all([getPayrollStatus(), getAllEvents()]);
  const exportEvents = events
    .filter(event => event.type === "event" && !event.deletedAt)
    .map(event => ({ id: event.id, title: event.title, date: event.date }));
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <PayrollExportClient rows={rows} events={exportEvents} />
      </div>
    </div>
  );
}