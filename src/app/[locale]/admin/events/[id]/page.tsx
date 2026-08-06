import { getReservationsByEvent } from "@/app/actions/reservations";
import { getTables } from "@/app/actions/tables";
import { getTentSettings } from "@/app/actions/settings";
import { getGalleryImages } from "@/app/actions/gallery";
import { getWaitlist } from "@/app/actions/waitlist";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import EventDetailDashboard from "./EventDetailDashboard";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const [eventData] = await db.select().from(events).where(eq(events.id, resolvedParams.id));
  
  if (!eventData) {
    notFound();
  }

  const [reservations, tables, tentSettings, galleryImages, waitlistEntries] = await Promise.all([
    getReservationsByEvent(resolvedParams.id),
    getTables(),
    getTentSettings(),
    getGalleryImages(resolvedParams.id),
    getWaitlist(resolvedParams.id)
  ]);

  return (
    <div className="min-h-screen bg-base-light pt-24 pb-12">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/admin" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline mb-2 inline-block">
              &larr; Zurück zu allen Events
            </Link>
            <h1 className="text-4xl font-display font-black text-base-dark">
              Event: <span className="text-accent-green">{eventData.title}</span>
            </h1>
          </div>
        </div>
        
        <EventDetailDashboard 
          event={eventData}
          initialReservations={reservations} 
          initialTables={tables}
          tentSettings={tentSettings}
          initialGallery={galleryImages}
          initialWaitlist={waitlistEntries}
        />
      </div>
    </div>
  );
}
