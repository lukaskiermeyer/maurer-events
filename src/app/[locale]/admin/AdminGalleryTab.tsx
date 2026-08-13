"use client";

import { useState, useRef } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { deleteEvent, createEvent, convertEventToGallery, toggleFeaturedGallery } from "@/app/actions/events";
import { uploadImage } from "@/app/actions/upload";

export default function AdminGalleryTab({ 
  galleries,
  convertibleEvents 
}: { 
  galleries: any[],
  convertibleEvents: any[] 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Optimistic UI state for instant star toggling
  const [featuredState, setFeaturedState] = useState<Record<string, boolean>>({});

  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    location: "",
    description: "",
    imageUrl: "",
  });

  const pastEvents = convertibleEvents.filter(e => {
    const end = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return end < new Date();
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if(confirm("Album wirklich löschen? Es wird erst in 7 Tagen endgültig gelöscht.")) {
      await deleteEvent(id);
      window.location.reload();
    }
  };

  const handleConvert = async (event: any) => {
    if(confirm(`Möchtest du das Event "${event.title}" wirklich in ein Galerie-Album umwandeln?`)) {
      setLoading(true);
      try {
        // Create a new gallery event with the same data, or just update the existing one?
        // Wait, to keep it simple, we can update the existing one via an action or recreate it.
        // Actually, the simplest is to just call a server action to update type to 'gallery'.
        // But since we don't have a direct "updateType" action exported, let's create it in `events.ts`.
        // I will implement a quick server action inside a new file or add it to events.ts.
        await convertEventToGallery(event.id);
        window.location.reload();
      } catch (err) {
        alert("Fehler bei der Umwandlung.");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalImageUrl = formData.imageUrl;
      
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const uploadRes = await uploadImage(uploadData);
        if (uploadRes.success) {
          finalImageUrl = uploadRes.url;
        } else {
          alert("Fehler beim Bildupload: " + uploadRes.error);
          setLoading(false);
          return;
        }
      }

      await createEvent({
        ...formData,
        imageUrl: finalImageUrl,
        date: new Date(formData.date),
        link: "",
        reservable: false,
        type: 'gallery'
      });
      setFormData({
        title: "", date: "", location: "", description: "", imageUrl: "",
      });
      setFile(null);
      window.location.reload();
    } catch (err) {
      alert("Fehler beim Speichern.");
    }
    setLoading(false);
  };

  const handleToggleFeatured = async (e: React.MouseEvent, id: string, currentState: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    
    const newState = !currentState;
    // Optimistic update
    setFeaturedState(prev => ({ ...prev, [id]: newState }));
    
    setLoading(true);
    try {
      await toggleFeaturedGallery(id, newState);
      router.refresh();
    } catch (err) {
      // Rollback on error
      setFeaturedState(prev => ({ ...prev, [id]: currentState }));
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-[500px]">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border-light rounded-lg text-sm font-bold shadow-sm hover:bg-base-light transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Sortieren: {sortOrder === "desc" ? "Neueste zuerst" : "Älteste zuerst"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...galleries].sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        }).map(album => {
          const isFeatured = featuredState[album.id] !== undefined ? featuredState[album.id] : album.isFeaturedGallery;

          return (
            <div key={album.id} className="bg-white border border-border-light rounded-2xl overflow-hidden flex flex-col group hover:shadow-lg transition-all relative">
              
              <div className="aspect-[4/3] bg-base-light relative">
                {album.imageUrl ? (
                  <img src={album.imageUrl} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm opacity-50">Kein Cover</div>
                )}
                {/* Featured Toggle (Star) */}
                <button
                  onClick={(e) => handleToggleFeatured(e, album.id, isFeatured)}
                  disabled={loading}
                  className={`absolute top-3 left-3 z-10 p-2 rounded-full backdrop-blur-sm transition-all shadow-sm ${
                    isFeatured 
                      ? "bg-yellow-400 text-white hover:bg-yellow-500 hover:scale-110" 
                      : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white hover:scale-110"
                  }`}
                  title={isFeatured ? "Von Startseite entfernen" : "Auf Startseite anzeigen"}
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg mb-1">{album.title}</h3>
                <p className="text-xs opacity-60 mb-4">{new Date(album.date).toLocaleDateString('de-DE')} • {album.location}</p>
                
                <div className="flex gap-2 mt-auto">
                  <Link href={`/admin/events/${album.id}`} className="flex-1 text-center bg-base-light hover:bg-base-dark hover:text-white transition-colors text-sm font-bold py-2 rounded-lg">
                    Bearbeiten
                  </Link>
                <button onClick={(e) => handleDelete(e, album.id)} className="px-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )})}
        {galleries.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-50">
            Noch keine Galerie-Alben vorhanden.
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-accent-green text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 hover:shadow-2xl transition-all z-40"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-border-light flex justify-between items-center z-10">
              <h2 className="text-xl font-bold font-display">Galerie-Album erstellen</h2>
              <button onClick={() => { setIsModalOpen(false); setShowCreateForm(false); }} className="p-2 hover:bg-base-light rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {!showCreateForm ? (
                <>
                  <div>
                    <button 
                      onClick={() => setShowCreateForm(true)}
                      className="w-full bg-accent-green text-white font-bold py-4 rounded-xl hover:bg-base-dark transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Neues, leeres Album erstellen
                    </button>
                  </div>

                  {pastEvents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1 h-px bg-border-light"></div>
                        <span className="text-sm font-bold opacity-50 uppercase tracking-widest">Oder umwandeln</span>
                        <div className="flex-1 h-px bg-border-light"></div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-sm opacity-70 mb-4">Hier sind vergangene Events, die noch keine Galerie sind. Mit einem Klick kannst du sie in ein Galerie-Album umwandeln.</p>
                        {pastEvents.map(event => (
                          <div key={event.id} className="flex justify-between items-center p-4 border border-border-light rounded-xl hover:border-accent-green transition-colors">
                            <div>
                              <div className="font-bold">{event.title}</div>
                              <div className="text-xs opacity-70">{new Date(event.date).toLocaleDateString('de-DE')} • {event.location}</div>
                            </div>
                            <button 
                              onClick={() => handleConvert(event)}
                              disabled={loading}
                              className="text-sm bg-base-light px-4 py-2 rounded-lg font-bold hover:bg-accent-green hover:text-white transition-colors disabled:opacity-50"
                            >
                              Umwandeln
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 font-sans">
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Titel</label>
                    <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Fasching 2019" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Datum</label>
                    <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Location</label>
                    <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Festzelt" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Beschreibung</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green min-h-[100px]" placeholder="Kurze Event-Beschreibung..." />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold mb-1 opacity-70">Cover-Bild</label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                          className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green text-sm" 
                        />
                      </div>
                      <div className="flex items-center text-sm font-bold opacity-50">ODER</div>
                      <div className="flex-1">
                        <input 
                          type="url" 
                          value={formData.imageUrl} 
                          onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                          className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green" 
                          placeholder="Bild-URL" 
                          disabled={file !== null}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 bg-base-light font-bold py-3 rounded-lg hover:bg-border-light transition-colors">
                      Zurück
                    </button>
                    <button disabled={loading} type="submit" className="flex-1 bg-accent-green text-white font-bold py-3 rounded-lg disabled:opacity-50 hover:bg-base-dark transition-colors">
                      {loading ? "Speichert..." : "Album Speichern"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
