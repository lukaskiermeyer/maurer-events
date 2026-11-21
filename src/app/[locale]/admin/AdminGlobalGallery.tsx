"use client";

import type { EventRecord, GalleryWithEvent } from '@/types/domain';

import { useState } from "react";
import Image from "next/image";
import { uploadImage } from "@/lib/client-image-upload";
import { addGalleryImage, removeGalleryImage, setGalleryFavorite, moveGalleryFavorite, replaceGalleryImage } from "@/app/actions/gallery";
import DropZone from "@/components/ui/DropZone";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";

export default function AdminGlobalGallery({ events, initialGallery }: { events: EventRecord[], initialGallery: GalleryWithEvent[] }) {
  const toast = useToast();
  const dialog = useDialog();
  const [isUpdating, setIsUpdating] = useState(false);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(events.length > 0 ? events[0].id : "");

  const handleGalleryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      toast.showToast("Bitte wähle ein Event aus.", "warning");
      return;
    }
    if (!galleryFile && !galleryUrl) {
      toast.showToast("Bitte wähle ein Bild aus oder gib eine URL ein.", "warning");
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
          toast.showToast("Upload fehlgeschlagen: " + res.error, "error");
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
      toast.showToast("Fehler beim Hochladen.", "error");
    }
    setIsUpdating(false);
  };

  const groupedAlbums = initialGallery.reduce((acc, img) => {
    const eventId = img.event?.id ?? "__unlinked__";
    if (!acc[eventId]) {
      acc[eventId] = {
        event: img.event ?? ({ id: eventId, title: "Ohne Fest", date: new Date() } as unknown as EventRecord),
        images: []
      };
    }
    acc[eventId].images.push(img);
    return acc;
  }, {} as Record<string, { event: EventRecord; images: GalleryWithEvent[] }>);
  
  const albumList = Object.values(groupedAlbums);
  const favorites = initialGallery
    .filter(i => i.gallery.isFavorite)
    .sort((a, b) => a.gallery.favoriteOrder - b.gallery.favoriteOrder);

  const handleReplace = async (imageId: string, file: File) => {
    setIsUpdating(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadImage(fd);
      if (res.success) {
        await replaceGalleryImage(imageId, res.url);
        window.location.reload();
      } else {
        toast.showToast("Upload fehlgeschlagen: " + res.error, "error");
      }
    } catch {
      toast.showToast("Fehler beim Ersetzen.", "error");
    }
    setIsUpdating(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">

      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h4 className="font-subhead text-xl">Startseiten-Favoriten ({favorites.length}/8)</h4>
          <span className="text-xs font-bold opacity-60">Reihenfolge = Anzeige auf der Startseite · unten Bilder mit Stern markieren</span>
        </div>
        {favorites.length === 0 ? (
          <p className="text-sm opacity-60">Noch keine Favoriten. Markiere unten Bilder mit dem Stern, um sie hier aufzunehmen.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {favorites.map((fav, i) => (
              <div key={fav.gallery.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light bg-base-light group">
                <Image src={fav.gallery.imageUrl} alt="" fill sizes="12vw" className="object-cover" />
                <span className="absolute top-1 left-1 bg-accent-green text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">{i + 1}</span>
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-black/55 p-1 text-sm">
                  <button onClick={async () => { await moveGalleryFavorite(fav.gallery.id, -1); window.location.reload(); }} disabled={i === 0} className="text-white disabled:opacity-30" aria-label="Nach vorne" title="Nach vorne">↑</button>
                  <button onClick={async () => { await moveGalleryFavorite(fav.gallery.id, 1); window.location.reload(); }} disabled={i === favorites.length - 1} className="text-white disabled:opacity-30" aria-label="Nach hinten" title="Nach hinten">↓</button>
                  <label className="text-white cursor-pointer" title="Bild ersetzen">
                    ⇄
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleReplace(fav.gallery.id, f); }} />
                  </label>
                  <button onClick={async () => { await setGalleryFavorite(fav.gallery.id, false); window.location.reload(); }} className="text-red-300" aria-label="Aus Favoriten entfernen" title="Aus Favoriten entfernen">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm">
        <h4 className="mb-4 font-subhead text-xl">Neues Bild zur Galerie hinzufügen</h4>
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
            <DropZone
              accept="image/*"
              disabled={galleryUrl.length > 0}
              label={galleryFile ? galleryFile.name : "Bild hierher ziehen oder klicken"}
              onFiles={files => setGalleryFile(files[0] || null)}
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
          albumList.map((album) => (
            <div key={album.event.id} className="bg-white p-6 rounded-2xl border border-border-light shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-subhead text-xl text-base-dark">
                  {album.event.title} <span className="text-sm font-sans font-normal opacity-50">({new Date(album.event.date).toLocaleDateString('de-DE')})</span>
                </h3>
                <div className="text-sm font-bold bg-base-light px-3 py-1 rounded-full text-base-dark/70">
                  {album.images.length} Bilder
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {album.images.map((img) => (
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
                        if (!img.gallery.isFavorite && favorites.length >= 8) {
                          toast.showToast("Maximal 8 Favoriten für die Startseite.", "warning");
                          return;
                        }
                        await setGalleryFavorite(img.gallery.id, !img.gallery.isFavorite);
                        window.location.reload();
                      }}
                      className={`admin-image-action absolute top-2 left-2 w-11 h-11 rounded-full transition-opacity flex items-center justify-center font-bold shadow-md z-10 ${img.gallery.isFavorite ? "bg-accent-gold text-white" : "bg-white/90 text-base-dark"}`}
                      title={img.gallery.isFavorite ? "Aus Favoriten entfernen" : "Als Startseiten-Favorit markieren"}
                      aria-label={img.gallery.isFavorite ? "Aus Favoriten entfernen" : "Als Startseiten-Favorit markieren"}
                    >
                      ★
                    </button>
                    <button 
                      onClick={async () => {
                        if (await dialog.confirm({ title: "Bild löschen", message: "Bild wirklich löschen?", danger: true, confirmLabel: "Löschen" })) {
                          setIsUpdating(true);
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
          ))
        )}
      </div>
    </div>
  );
}
