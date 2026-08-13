"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadImage } from "@/app/actions/upload";
import { addGalleryImage, removeGalleryImage } from "@/app/actions/gallery";

export default function AdminGlobalGallery({ events, initialGallery }: { events: any[], initialGallery: any[] }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(events.length > 0 ? events[0].id : "");

  const handleGalleryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      alert("Bitte wähle ein Event aus.");
      return;
    }
    if (!galleryFile && !galleryUrl) {
      alert("Bitte wähle ein Bild aus oder gib eine URL ein.");
      return;
    }
    
    setIsUpdating(true);
    try {
      let finalUrl = galleryUrl;
      if (galleryFile) {
        const uploadData = new FormData();
        uploadData.append("file", galleryFile);
        const res = await uploadImage(uploadData);
        if (res.success) {
          finalUrl = res.url;
        } else {
          alert("Upload failed: " + res.error);
          setIsUpdating(false);
          return;
        }
      }
      if (finalUrl) {
        await addGalleryImage(selectedEventId, finalUrl);
        setGalleryFile(null);
        setGalleryUrl("");
        window.location.reload(); // Quick refresh to show new image
      }
    } catch (err) {
      console.error(err);
      alert("Fehler beim Hochladen.");
    }
    setIsUpdating(false);
  };

  const groupedAlbums = initialGallery.reduce((acc, img) => {
    const eventId = img.event.id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: img.event,
        images: []
      };
    }
    acc[eventId].images.push(img);
    return acc;
  }, {} as Record<string, any>);
  
  const albumList = Object.values(groupedAlbums);

  return (
    <div className="space-y-8 animate-fade-in">
      
      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm">
        <h4 className="font-bold mb-4 font-display text-xl">Neues Bild zur Galerie hinzufügen</h4>
        <form onSubmit={handleGalleryUpload} className="flex flex-col md:flex-row gap-4 items-end">
          
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold uppercase opacity-70 mb-1">Zugehöriges Event</label>
            <select 
              value={selectedEventId} 
              onChange={e => setSelectedEventId(e.target.value)}
              className="w-full bg-base-light p-3 rounded-lg border border-border-light text-sm focus:border-accent-green outline-none"
              required
            >
              <option value="" disabled>Event auswählen...</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title} ({new Date(ev.date).toLocaleDateString('de-DE')})</option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase opacity-70 mb-1">Lokale Datei</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => setGalleryFile(e.target.files ? e.target.files[0] : null)} 
              className="w-full bg-base-light p-2 rounded-lg border border-border-light text-sm" 
              disabled={galleryUrl.length > 0} 
            />
          </div>
          <div className="font-bold opacity-50 py-3 text-sm">ODER</div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase opacity-70 mb-1">Bild-URL (extern)</label>
            <input 
              type="url" 
              value={galleryUrl} 
              onChange={e => setGalleryUrl(e.target.value)} 
              placeholder="https://..." 
              className="w-full bg-base-light p-3 rounded-lg border border-border-light text-sm focus:border-accent-green outline-none" 
              disabled={galleryFile !== null} 
            />
          </div>
          <button 
            type="submit" 
            disabled={isUpdating || (!galleryFile && !galleryUrl) || !selectedEventId} 
            className="bg-accent-green text-white font-bold px-6 py-3 rounded-lg text-sm disabled:opacity-50 hover:bg-base-dark transition-colors"
          >
            {isUpdating ? "Lädt..." : "Hochladen"}
          </button>
        </form>
      </div>

      <div className="space-y-12">
        {albumList.length === 0 ? (
          <p className="text-center opacity-50 py-10 bg-white rounded-xl border border-border-light shadow-sm">Keine Bilder in der Galerie.</p>
        ) : (
          albumList.map((album: any) => (
            <div key={album.event.id} className="bg-white p-6 rounded-2xl border border-border-light shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold font-display text-xl text-base-dark">
                  {album.event.title} <span className="text-sm font-sans font-normal opacity-50">({new Date(album.event.date).toLocaleDateString('de-DE')})</span>
                </h3>
                <div className="text-sm font-bold bg-base-light px-3 py-1 rounded-full text-base-dark/70">
                  {album.images.length} Bilder
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {album.images.map((img: any) => (
                  <div key={img.gallery.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light group shadow-sm bg-base-light">
                    <Image 
                      src={img.gallery.imageUrl} 
                      alt="Gallery image" 
                      fill 
                      sizes="(max-width: 768px) 50vw, 20vw" 
                      className="object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <button 
                      onClick={async () => {
                        if (confirm("Bild wirklich löschen?")) {
                          setIsUpdating(true);
                          await removeGalleryImage(img.gallery.id);
                          window.location.reload();
                        }
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold shadow-md hover:bg-red-600 z-10"
                      title="Bild löschen"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
