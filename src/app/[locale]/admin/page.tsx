import { getEvents, getAdminStats } from "@/app/actions/events";
import AdminEventList from "./AdminEventList";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin(true);
  
  let events = [];
  let stats = null;
  try {
    events = await getEvents();
    stats = await getAdminStats();
  } catch (error) {
    console.error("Datenbank-Verbindung fehlgeschlagen. Bitte DATABASE_URL prüfen.", error);
  }

  return (
    <div className="min-h-screen bg-base-light pt-24 pb-12">
      <div className="max-w-[1200px] mx-auto px-4">
        <h1 className="text-4xl font-display font-black text-base-dark mb-8">Admin <span className="text-accent-green">Panel</span></h1>
        
        {events.length === 0 && (
          <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 p-4 rounded-xl mb-8 font-sans text-sm">
            Hinweis: Keine Events gefunden oder Datenbank nicht verbunden. Hast du die DATABASE_URL in die .env.local eingetragen und <code>npx drizzle-kit push</code> ausgeführt?
          </div>
        )}

        <AdminEventList initialEvents={events} stats={stats} />
      </div>
    </div>
  );
}
