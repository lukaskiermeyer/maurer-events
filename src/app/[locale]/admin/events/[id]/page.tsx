import { getReservationsByEvent } from "@/app/actions/reservations";
import { getTables } from "@/app/actions/tables";
import { getTentSettings, getPackagePresets, getTaxStatus } from "@/app/actions/settings";
import { getEventGalleryImages } from "@/app/actions/gallery";
import { getWaitlist } from "@/app/actions/waitlist";
import { getEventSettings } from "@/app/actions/eventSettings";
import { getAdminEventDocuments } from "@/app/actions/eventDocuments";
import { getPlanPresets, getEventPlan } from "@/app/actions/plans";
import { db } from "@/db";
import { events, scannerAccess } from "@/db/schema";
import { eq } from "drizzle-orm";
import EventDetailDashboard from "./EventDetailDashboard";
import { Link } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import StaffHeader from '@/components/admin/StaffHeader';

export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(true);
  const resolvedParams = await params;
  const [eventData] = await db.select().from(events).where(eq(events.id, resolvedParams.id));
  
  if (!eventData) {
    notFound();
  }

  const [reservations, tables, tentSettings, galleryImages, waitlistEntries, eventSettings, scannerGrants, packagePresets, taxStatus, documents, planPresets, eventPlan] = await Promise.all([
    getReservationsByEvent(resolvedParams.id),
    getTables(),
    getTentSettings(),
    getEventGalleryImages(resolvedParams.id),
    getWaitlist(resolvedParams.id),
    getEventSettings(resolvedParams.id),
    db.select({ id: scannerAccess.id, email: scannerAccess.email, validUntil: scannerAccess.validUntil }).from(scannerAccess).where(eq(scannerAccess.eventId, resolvedParams.id)),
    getPackagePresets(),
    getTaxStatus(),
    getAdminEventDocuments(resolvedParams.id),
    getPlanPresets(),
    getEventPlan(resolvedParams.id)
  ]);

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div className="min-w-0 flex-1 basis-64">
            <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">
              &larr; Zurück zu allen Events
            </Link>
            <h1 className="text-2xl sm:text-4xl font-display font-black text-base-dark break-words">
              {eventData.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/events/${eventData.id}/scanner`} className="min-h-12 inline-flex items-center px-5 bg-accent-green text-white rounded-xl font-bold">Einlass starten</Link>
          </div>
        </div>
        
        <EventDetailDashboard 
          event={eventData}
          initialReservations={reservations} 
          initialTables={tables}
          tentSettings={tentSettings}
          initialGallery={galleryImages}
          initialWaitlist={waitlistEntries}
          initialEventSettings={eventSettings}
          initialPackagePresets={packagePresets}
          taxStatus={taxStatus}
          initialDocuments={documents}
          scannerGrants={scannerGrants}
          stripeEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
          planPreset={eventPlan}
          planPresets={planPresets}
        />
      </div>
    </div>
  );
}
