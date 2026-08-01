import { getReservationsByEvent } from "@/app/actions/reservations";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrintLayout from "./PrintLayout";

export const dynamic = "force-dynamic";

export default async function PrintReservationsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [eventData] = await db.select().from(events).where(eq(events.id, resolvedParams.id));
  
  if (!eventData) {
    notFound();
  }

  const reservations = await getReservationsByEvent(resolvedParams.id);
  
  // Filter out cancelled ones, only show paid or confirmed
  const validReservations = reservations.filter(r => r.reservation.status === 'paid' || r.reservation.status === 'confirmed');

  // Group by date, then by table
  const grouped: Record<string, Record<string, typeof validReservations>> = {};
  
  validReservations.forEach(r => {
    const dateStr = new Date(r.reservation.reservationDate).toLocaleDateString('de-DE');
    const tableKey = r.tableName || "Kein Tisch";
    
    if (!grouped[dateStr]) grouped[dateStr] = {};
    if (!grouped[dateStr][tableKey]) grouped[dateStr][tableKey] = [];
    
    grouped[dateStr][tableKey].push(r);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const [d1, m1, y1] = a.split('.');
    const [d2, m2, y2] = b.split('.');
    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
  });

  return (
    <PrintLayout eventTitle={eventData.title} eventDate={new Date(eventData.date).toLocaleDateString('de-DE')}>
      {sortedDates.map(date => {
        const tablesForDate = grouped[date];
        // Sort tables (basic alphabetical sort)
        const sortedTables = Object.keys(tablesForDate).sort((a, b) => {
          if (a === "Kein Tisch") return 1;
          if (b === "Kein Tisch") return -1;
          return a.localeCompare(b);
        });
        
        return (
          <div key={date} className="mb-12 page-break-after-avoid">
            <h2 className="text-2xl font-bold mb-4 border-b-2 border-black pb-2">
              Datum: {date}
            </h2>
            
            <div className="space-y-6">
              {sortedTables.map(tableName => (
                <div key={tableName} className="mb-6 break-inside-avoid">
                  <h3 className="text-xl font-semibold mb-2 bg-gray-100 p-2">Tisch: {tableName}</h3>
                  <table className="w-full text-left border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="p-2 border-r border-gray-300 w-12 text-center">Status</th>
                        <th className="p-2 border-r border-gray-300">Gast</th>
                        <th className="p-2 border-r border-gray-300 w-24">Personen</th>
                        <th className="p-2 border-r border-gray-300">Email</th>
                        <th className="p-2 w-32">Uhrzeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablesForDate[tableName].map(r => (
                        <tr key={r.reservation.id} className="border-b border-gray-200">
                          <td className="p-2 border-r border-gray-300 text-center">
                            <div className="w-5 h-5 border-2 border-black inline-block rounded-sm"></div>
                          </td>
                          <td className="p-2 border-r border-gray-300 font-medium">
                            {r.reservation.guestName}
                          </td>
                          <td className="p-2 border-r border-gray-300 text-center">
                            {r.reservation.guestCount}
                          </td>
                          <td className="p-2 border-r border-gray-300 text-sm text-gray-600">
                            {r.reservation.email}
                          </td>
                          <td className="p-2">
                            <span className="text-gray-400">______</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      
      {validReservations.length === 0 && (
        <p className="text-center text-gray-500 italic mt-12">Keine gültigen Reservierungen vorhanden.</p>
      )}
    </PrintLayout>
  );
}
