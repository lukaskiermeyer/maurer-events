import { getAllEvents, getAdminStats } from "@/app/actions/events";
import AdminTabs from "./AdminTabs";
import { Link } from "@/i18n/routing";

import { requireAdmin } from "@/lib/auth";
import StaffHeader from '@/components/admin/StaffHeader';

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin(true);
  
  let events = [];
  let stats = null;
  let loadFailed = false;
  try {
    events = await getAllEvents();
    stats = await getAdminStats();
  } catch {
    loadFailed = true;
    console.error("Admin overview unavailable");
  }

  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <div className="max-w-[1200px] mx-auto px-4 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div><h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Deine Veranstaltungen</h1><p className="mt-2 text-base-dark/60">Buchungen verwalten, Helfer freigeben und den Einlass starten.</p></div>
          <Link href="/admin/scan" className="min-h-12 inline-flex items-center px-5 rounded-xl bg-accent-green text-white font-bold">Tickets scannen</Link>
        </div>
        
        {loadFailed && (
          <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 p-4 rounded-xl mb-8 font-sans text-sm">
            Die Übersicht konnte nicht geladen werden. Bitte lade die Seite erneut.
          </div>
        )}

        <AdminTabs initialEvents={events} stats={stats} />
      </div>
    </div>
  );
}
