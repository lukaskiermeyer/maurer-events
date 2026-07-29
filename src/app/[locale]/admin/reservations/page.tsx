import { db } from '@/db';
import { events, reservations, tables } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ReservationAdminMap from './ReservationAdminMap';

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: selectedEventId } = await searchParams;
  
  const allEvents = await db.select().from(events);
  const allTables = await db.select().from(tables);
  
  let eventReservations: any[] = [];
  if (selectedEventId) {
    eventReservations = await db.select().from(reservations).where(eq(reservations.eventId, selectedEventId));
  }

  return (
    <div className="min-h-screen bg-base-light pt-24 pb-12">
      <div className="max-w-[1400px] mx-auto px-4">
        <h1 className="text-4xl font-display font-black text-base-dark mb-8">Saalplan & <span className="text-accent-green">Reservierungen</span></h1>
        
        {/* Event Selector */}
        <div className="mb-8">
          <label className="block text-sm font-bold text-base-dark mb-2">Event auswählen</label>
          <form method="GET">
            <select 
              name="event" 
              defaultValue={selectedEventId || ""}
              onChange={(e) => e.target.form?.submit()}
              className="bg-white border border-border-light rounded-xl px-4 py-3 min-w-[300px] font-sans"
            >
              <option value="" disabled hidden>Bitte Event wählen...</option>
              {allEvents.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </form>
        </div>

        {selectedEventId ? (
          <ReservationAdminMap 
            tables={allTables} 
            reservations={eventReservations} 
            eventId={selectedEventId as string} 
          />
        ) : (
          <div className="bg-white border border-border-light rounded-3xl p-12 text-center text-base-dark/50 font-bold">
            Bitte wähle ein Event aus, um den Saalplan zu laden.
          </div>
        )}
      </div>
    </div>
  );
}
