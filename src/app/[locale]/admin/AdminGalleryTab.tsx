"use client";
import Image from 'next/image';

import type { EventRecord, GalleryWithEvent } from '@/types/domain';

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { deleteEvent, createEvent, convertEventToGallery, toggleFeaturedGallery, getEventDeletionSummary } from "@/app/actions/events";
import { addGalleryImage, removeGalleryImage } from "@/app/actions/gallery";
import { uploadImage } from "@/lib/client-image-upload";
import DropZone from "@/components/ui/DropZone";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";

export default function AdminGalleryTab({ 
  galleries,
  convertibleEvents,
  initialGallery = []
}: { 
  galleries: EventRecord[],
  convertibleEvents: EventRecord[],
  initialGallery?: GalleryWithEvent[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();

  // Optimistic UI state for instant star toggling
  const [featuredState, setFeaturedState] = useState<Record<string, boolean>>({});

  const [file, setFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [createStep, setCreateStep] = useState(1);
  const [formData, setFormData] = useState({    title: "",
    date: "",
    location: "",
    description: "",
    imageUrl: "",
  });

  // State for adding images to an existing album
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadUrl, setUploadUrl] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState(galleries.length > 0 ? galleries[0].id : "");
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0 && !uploadUrl) {
      toast.showToast("Bitte wähle ein Bild aus oder gib eine URL ein.", "warning");
      return;
    }
    setIsUploadingImages(true);
    try {
      const targetId = selectedAlbumId || null;
      if (uploadFiles.length > 0) {
        for (const f of uploadFiles) {
          const uploadData = new FormData();
          uploadData.append("file", f);
          const uploadRes = await uploadImage(uploadData);
          if (uploadRes.success) {
            await addGalleryImage(targetId, uploadRes.url);
          } else {
            toast.showToast("Fehler beim Bildupload: " + uploadRes.error, "error");
            setIsUploadingImages(false);
            return;
          }
        }
      } else if (uploadUrl) {
        await addGalleryImage(targetId, uploadUrl);
      }
      setUploadFiles([]);
      setUploadUrl("");
      window.location.reload();
    } catch {
      toast.showToast("Fehler beim Hochladen.", "error");
    }
    setIsUploadingImages(false);
  };

  const pastEvents = convertibleEvents.filter(e => {
    const end = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return end < new Date();
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const summary = await getEventDeletionSummary(id);
      const parts = [];
      if (summary.reservations > 0) parts.push(`${summary.reservations} Reservierung(en)`);
      if (summary.galleries > 0) parts.push(`${summary.galleries} Galeriebild(er)`);
      if (summary.waitlists > 0) parts.push(`${summary.waitlists} Wartelisteneintrag/-einträge`);
      const detail = parts.length ? `\nVerknüpft: ${parts.join(", ")}.` : "";
      const msg = `Album wirklich löschen?${detail}\n\nEs wird zuerst nur als gelöscht markiert und kann innerhalb von 7 Tagen wiederhergestellt werden. Danach wird es endgültig gelöscht.`;
      if (!await dialog.confirm({ title: "Album löschen", message: msg, danger: true, confirmLabel: "Löschen" })) return;
      await deleteEvent(id);
      window.location.reload();
    } catch (err) {
      toast.showToast("Fehler beim Löschen: " + (err instanceof Error ? err.message : ""), "error");
    }
  };

  const handleConvert = async (event: EventRecord) => {
    if (await dialog.confirm({ title: "In Galerie umwandeln", message: `Möchtest du das Event "${event.title}" wirklich in ein Galerie-Album umwandeln?`, confirmLabel: "Umwandeln" })) {
      setLoading(true);
      try {
        // Create a new gallery event with the same data, or just update the existing one?
        // Wait, to keep it simple, we can update the existing one via an action or recreate it.
        // Actually, the simplest is to just call a server action to update type to 'gallery'.
        // But since we don't have a direct "updateType" action exported, let's create it in `events.ts`.
        // I will implement a quick server action inside a new file or add it to events.ts.
        await convertEventToGallery(event.id);
        window.location.reload();
      } catch {
        toast.showToast("Fehler bei der Umwandlung.", "error");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createStep === 1) {
      if (!formData.title.trim() || !formData.date || !formData.location.trim() || !formData.description.trim()) {
        toast.showToast("Bitte alle Pflichtfelder ausfüllen.", "warning");
        return;
      }
      setCreateStep(2);
      return;
    }
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
          toast.showToast("Fehler beim Bildupload: " + uploadRes.error, "error");
          setLoading(false);
          return;
        }
      }

      const newId = await createEvent({
        ...formData,
        imageUrl: finalImageUrl,
        date: new Date(formData.date),
        link: "",
        reservable: false,
        type: 'gallery'
      });

      // Alle weiteren Bilder zum neuen Album hochladen
      if (newId && galleryFiles.length > 0) {
        for (const gf of galleryFiles) {
          const uploadData = new FormData();
          uploadData.append("file", gf);
          const uploadRes = await uploadImage(uploadData);
          if (uploadRes.success) {
            await addGalleryImage(newId, uploadRes.url);
          } else {
            toast.showToast("Fehler beim Bildupload: " + uploadRes.error, "error");
          }
        }
      }

      setFormData({
        title: "", date: "", location: "", description: "", imageUrl: "",
      });
      setFile(null);
      setGalleryFiles([]);
      setCreateStep(1);
      setShowCreateForm(false);
      window.location.reload();
    } catch {
      toast.showToast("Fehler beim Speichern.", "error");
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
    } catch {
      // Rollback on error
      setFeaturedState(prev => ({ ...prev, [id]: currentState }));
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-[500px] pb-24">
      {/* Prominenter Hinzufügen-Button oben */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="font-subhead text-2xl text-base-dark">Galerie verwalten</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-accent-green text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-base-dark transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Album / Bilder hinzufügen
        </button>
      </div>

      {/* Bilder zu bestehendem Album hinzufügen */}
      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm mb-6">
        <h4 className="mb-4 font-subhead text-xl">Bilder zu Album hinzufügen</h4>
        {galleries.length === 0 ? (
          <p className="text-sm opacity-50">Noch keine Alben vorhanden. Erstelle zuerst ein Album.</p>
        ) : (
          <form onSubmit={handleImageUpload} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/4">
              <label className="block text-xs font-bold uppercase opacity-70 mb-1">Zugehöriges Fest (optional)</label>
              <select
                value={selectedAlbumId}
                onChange={e => setSelectedAlbumId(e.target.value)}
                className="w-full bg-base-light p-3 rounded-lg border border-border-light text-sm focus:border-accent-green outline-none"
              >
                <option value="">Kein Fest (allgemein)</option>
                {galleries.map(g => (
                  <option key={g.id} value={g.id}>{g.title} ({new Date(g.date).toLocaleDateString('de-DE')})</option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase opacity-70 mb-1">Lokale Datei(en)</label>
              <DropZone
                multiple
                accept="image/*"
                disabled={uploadUrl.length > 0}
                label={uploadFiles.length ? `${uploadFiles.length} Datei(en) ausgewählt` : "Bilder hierher ziehen oder klicken"}
                onFiles={files => setUploadFiles(files)}
              />
            </div>
            <div className="font-bold opacity-50 py-3 text-sm">ODER</div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase opacity-70 mb-1">Bild-URL (extern)</label>
              <input
                type="url"
                value={uploadUrl}
                onChange={e => setUploadUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-base-light p-3 rounded-lg border border-border-light text-sm focus:border-accent-green outline-none"
                disabled={uploadFiles.length > 0}
              />
            </div>
            <button
              type="submit"
              disabled={isUploadingImages || (uploadFiles.length === 0 && !uploadUrl)}
              className="bg-accent-green text-white font-bold px-6 py-3 rounded-lg text-sm disabled:opacity-50 hover:bg-base-dark transition-colors"
            >
              {isUploadingImages ? "Lädt..." : "Hinzufügen"}
            </button>
          </form>
        )}
      </div>

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
                  <Image src={album.imageUrl} alt={album.title} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm opacity-50">Kein Cover</div>
                )}
                {/* Featured Toggle (Star) */}
                <button
                  onClick={(e) => handleToggleFeatured(e, album.id, isFeatured)}
                  disabled={loading}
                  className={`absolute top-3 left-3 z-10 p-3 rounded-full backdrop-blur-sm transition-all shadow-sm ${
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
                <button aria-label={`${album.title} löschen`} onClick={(e) => handleDelete(e, album.id)} className="min-h-11 min-w-11 px-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded-lg flex items-center justify-center">
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

      {/* Bilder ohne Fest (nicht verknüpft) */}
      {(() => {
        const unlinked = initialGallery.filter(img => !img.event);
        if (unlinked.length === 0) return null;
        return (
          <div className="mt-8 bg-white p-6 rounded-2xl border border-border-light shadow-sm">
            <h4 className="mb-4 font-subhead text-xl">Bilder ohne Fest ({unlinked.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {unlinked.map((img) => (
                <div key={img.gallery.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light group shadow-sm bg-base-light">
                  <Image src={img.gallery.imageUrl} alt="Gallery image" fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover group-hover:scale-105 transition-transform" />
                  <button
                    onClick={async () => {
                      if (await dialog.confirm({ title: "Bild löschen", message: "Bild wirklich löschen?", danger: true, confirmLabel: "Löschen" })) {
                        setIsUploadingImages(true);
                        await removeGalleryImage(img.gallery.id);
                        window.location.reload();
                      }
                    }}
                    className="admin-image-action absolute top-2 right-2 bg-red-500 text-white w-11 h-11 rounded-full transition-opacity flex items-center justify-center font-bold shadow-md hover:bg-red-600 z-10"
                    title="Bild löschen"
                    aria-label="Bild löschen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Floating Action Button */}
      <button 
        aria-label="Galerie-Album erstellen"
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-accent-green text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 hover:shadow-2xl transition-all z-40"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-label="Galerie-Album erstellen" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-border-light flex justify-between items-center gap-3 z-10">
              <h2 className="text-xl font-bold font-display">Galerie-Album erstellen{showCreateForm ? ` – Schritt ${createStep} von 2` : ""}</h2>
              <button aria-label="Dialog schließen" onClick={() => { setIsModalOpen(false); setShowCreateForm(false); setCreateStep(1); }} className="p-2 min-h-11 min-w-11 shrink-0 hover:bg-base-light rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-8">
              {!showCreateForm ? (
                <>
                  <div>
                    <button 
                      onClick={() => { setShowCreateForm(true); setCreateStep(1); }}
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
                          <div key={event.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border border-border-light rounded-xl hover:border-accent-green transition-colors">
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
                  {createStep === 1 && (
                    <>
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
                     </>
                   )}

                   {createStep === 2 && (
                     <>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold mb-1 opacity-70">Cover-Bild</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <DropZone
                          accept="image/*"
                          label={file ? file.name : "Bild hierher ziehen oder klicken"}
                          onFiles={files => setFile(files[0] || null)}
                        />
                         {file && (/* eslint-disable-line @next/next/no-img-element */ <img src={URL.createObjectURL(file)} alt="Vorschau" className="mt-2 max-h-32 rounded-lg border border-border-light" />)}
                      </div>
                      <div className="flex items-center text-sm font-bold opacity-50">ODER</div>
                      <div className="min-w-0">
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
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-bold mb-1 opacity-70">Weitere Bilder (alle auf einmal)</label>
                    <DropZone
                      multiple
                      accept="image/*"
                      label={galleryFiles.length ? `${galleryFiles.length} Datei(en) ausgewählt` : "Bilder hierher ziehen oder klicken"}
                      onFiles={files => setGalleryFiles(files)}
                    />
                    {galleryFiles.length > 0 && (
                      <p className="text-xs opacity-60">{galleryFiles.length} Bild(er) ausgewählt</p>
                    )}
                  </div>

                     </>
                   )}

                  <div className="pt-4 flex gap-3">
                    {createStep === 2 && (
                      <button type="button" onClick={() => setCreateStep(1)} className="flex-1 bg-base-light font-bold py-3 rounded-lg hover:bg-border-light transition-colors">
                        Zurück
                      </button>
                    )}
                    {createStep === 1 && (
                      <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 bg-base-light font-bold py-3 rounded-lg hover:bg-border-light transition-colors">
                        Abbrechen
                      </button>
                    )}
                    <button disabled={loading} type="submit" className="flex-1 bg-accent-green text-white font-bold py-3 rounded-lg disabled:opacity-50 hover:bg-base-dark transition-colors">
                      {loading ? "Speichert..." : (createStep === 1 ? "Weiter" : "Album Speichern")}
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
