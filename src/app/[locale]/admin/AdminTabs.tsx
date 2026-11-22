"use client";

import type { EventRecord, AdminStats, CareerContent, GalleryWithAlbum, AdminGalleryAlbum, TeamMember } from '@/types/domain';

import { useState } from "react";
import AdminEventList from "./AdminEventList";
import AdminGalleryTab from "./AdminGalleryTab";
import AdminCareerTab from "./AdminCareerTab";
import AdminTeamTab from "./AdminTeamTab";

export default function AdminTabs({
  initialEvents,
  stats,
  careerContent,
  albums = [],
  initialGallery = [],
  teamMembers = []
}: {
  initialEvents: EventRecord[],
  stats?: AdminStats,
  careerContent: CareerContent,
  albums?: AdminGalleryAlbum[],
  initialGallery?: GalleryWithAlbum[],
  teamMembers?: TeamMember[]
}) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "events" | "gallery" | "career" | "about">("dashboard");

  // Galerie-Alben sind eigenständig (gallery_albums); Events sind nur noch Feste.
  const futureEvents = initialEvents.filter(e => e.type === 'event');

  const tabs = [
    { id: "dashboard", label: "Übersicht" },
    { id: "events", label: "Veranstaltungen" },
    { id: "gallery", label: "Galerie" },
    { id: "career", label: "Karriere" },
    { id: "about", label: "Über Uns" },
  ] as const;

  return (
    <div>
      {/* Tab Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 bg-white p-1 rounded-xl border border-border-light shadow-sm w-full sm:w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            aria-current={activeTab === tab.id ? 'true' : undefined}
            className={`px-2 sm:px-6 min-h-12 rounded-lg font-bold text-sm transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20'
                : 'text-base-dark/50 hover:text-base-dark hover:bg-base-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && stats && (
        <div className="animate-fade-in space-y-8">
          
          {/* Top KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 [&>div]:p-4 sm:[&>div]:p-6 [&_.text-4xl]:text-2xl sm:[&_.text-4xl]:text-4xl [&>div]:min-w-0">
            <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M9 4v16"/></svg></div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Offene Anfragen</div>
              <div className={`text-4xl font-display font-black ${(stats.openRequestsCount || 0) > 0 ? 'text-amber-600' : 'text-base-dark'}`}>{stats.openRequestsCount || 0}</div>
              <div className="text-xs font-bold text-accent-wood mt-2">E-Mail-Reservierungen zur Bestätigung</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Personallücken</div>
              <div className={`text-4xl font-display font-black ${(stats.staffGapsCount || 0) > 0 ? 'text-orange-500' : 'text-base-dark'}`}>{stats.staffGapsCount || 0}</div>
              <div className="text-xs font-bold text-orange-600 mt-2">{stats.staffedEventsWithGaps || 0} Feste mit offenen Schichten</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Mitarbeiter zur Prüfung</div>
              <div className={`text-4xl font-display font-black ${(stats.pendingStaffCount || 0) > 0 ? 'text-sky-600' : 'text-base-dark'}`}>{stats.pendingStaffCount || 0}</div>
              <div className="text-xs font-bold opacity-50 mt-2">{stats.pendingDocumentsCount || 0} Dokumente · {stats.pendingContractsCount || 0} Verträge offen</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Offene Schichtwünsche</div>
              <div className={`text-4xl font-display font-black ${(stats.selfSignupsPendingCount || 0) > 0 ? 'text-amber-600' : 'text-base-dark'}`}>{stats.selfSignupsPendingCount || 0}</div>
              <div className="text-xs font-bold opacity-50 mt-2">Selbst-Eintragungen zu bestätigen</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Next Event Widget */}
            <div className="lg:col-span-2 bg-canvas-light p-5 sm:p-8 rounded-3xl border border-border-light relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <h2 className="text-2xl font-display font-bold mb-6 text-base-dark">Nächstes Fest im Fokus 🎯</h2>
              
              {stats.nextEventStats ? (
                <div>
                  <h3 className="text-3xl font-black mb-2">{stats.nextEventStats.title}</h3>
                  <div className="text-sm font-bold text-base-dark/60 mb-8 uppercase tracking-widest">
                    {new Date(stats.nextEventStats.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span>Kapazitätsauslastung</span>
                      <span>{stats.nextEventStats.guests} {stats.nextEventStats.capacity !== "Unlimitiert" ? `/ ${stats.nextEventStats.capacity}` : ''} Gäste</span>
                    </div>
                    {stats.nextEventStats.capacity !== "Unlimitiert" && (
                      <div className="w-full bg-border-light rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-accent-green h-3 rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(100, (stats.nextEventStats.guests / (Number(stats.nextEventStats.capacity) || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => setActiveTab("events")} className="mt-8 bg-base-dark text-white px-6 py-3 rounded-lg font-bold hover:bg-accent-green transition-colors text-sm">
                    Fest & Reservierungen bearbeiten
                  </button>
                </div>
              ) : (
                <p className="opacity-80">Aktuell ist kein zukünftiges Fest geplant. Wechsle zu &quot;Aktuelle &amp; Zukünftige Feste&quot;, um eines zu erstellen.</p>
              )}
            </div>
            
            {/* Recent Activity Widget */}
            <div className="bg-white p-6 rounded-3xl border border-border-light shadow-sm">
              <h2 className="text-lg font-display font-bold mb-6 text-base-dark flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Neue Reservierungen
              </h2>
              
              {stats.recentReservations && stats.recentReservations.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentReservations.map((res) => (
                    <div key={res.id} className="flex items-center justify-between border-b border-border-light/50 pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="font-bold text-sm text-base-dark truncate max-w-[150px]">{res.guestName}</div>
                        <div className="text-xs opacity-50">{new Date(res.createdAt).toLocaleDateString('de-DE')} • {(res.amountTotal/100).toFixed(2)}€</div>
                      </div>
                      <div>
                        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-full ${
                          res.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          res.status === 'paid' ? 'bg-green-100 text-green-800' :
                          res.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {res.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-50">Keine aktuellen Reservierungen.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <AdminEventList initialEvents={futureEvents} stats={stats} />
      )}
      
      {activeTab === "gallery" && (
        <AdminGalleryTab albums={albums} convertibleEvents={futureEvents} initialGallery={initialGallery} />
      )}

      {activeTab === "career" && (
        <AdminCareerTab initialContent={careerContent} />
      )}

      {activeTab === "about" && (
        <AdminTeamTab initialMembers={teamMembers} />
      )}
    </div>
  );
}
