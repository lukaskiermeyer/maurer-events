import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getVouchersForEvent } from "@/app/actions/vouchers";
import StaffHeader from "@/components/admin/StaffHeader";
import VoucherAdmin from "./VoucherAdmin";

export const dynamic = "force-dynamic";

export default async function EventVouchersPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const { id } = await params;
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event || event.deletedAt) notFound();
  const vouchers = await getVouchersForEvent(id);

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-accent-green mb-2">Gutscheine</p>
          <h1 className="text-2xl sm:text-4xl font-display font-black text-base-dark break-words">{event.title}</h1>
        </div>
        <VoucherAdmin event={event} vouchers={vouchers} />
      </div>
    </div>
  );
}