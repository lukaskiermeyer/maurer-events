"use client";
import Image from "next/image";
import { useState } from "react";
import type { AdminGalleryAlbum, GalleryImage } from "@/types/domain";
import { uploadImage } from "@/lib/client-image-upload";
import { addGalleryImage } from "@/app/actions/gallery";
import { translateTextsNow } from "@/app/actions/translations";
import LocalizedFields, { type Lang, type LocValues } from "@/components/admin/LocalizedFields";
import DropZone from "@/components/ui/DropZone";
import { useToast } from "@/components/ui/Toast";

export type AlbumDetailInput = {
  title: string;
  date: Date;
  location: string;
  description: string;
  coverImageUrl: string | null;
  titleEn?: string | null;
  titleBar?: string | null;
  locationEn?: string | null;
  locationBar?: string | null;
  descriptionEn?: string | null;
  descriptionBar?: string | null;
};

export default function AdminAlbumCard({
  album,
  position,
  canMoveUp,
  canMoveDown,
  onMoveAlbum,
  saved,
  images,
  favoriteIndex,
  expanded,
  onToggleExpand,
  onToggleFavorite,
  onDeleteImage,
  onSetCover,
  onUploaded,
  onSaveAlbum,
  onDeleteAlbum,
}: {
  album: AdminGalleryAlbum;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveAlbum: (albumId: string, dir: -1 | 1) => Promise<void>;
  saved: boolean;
  images: GalleryImage[];
  favoriteIndex: Map<string, number>;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: (imageId: string, next: boolean) => Promise<void>;
  onDeleteImage: (imageId: string) => Promise<void>;
  onSetCover: (albumId: string, imageId: string) => Promise<void>;
  onUploaded: (albumId: string, rows: GalleryImage[]) => void;
  onSaveAlbum: (albumId: string, data: AlbumDetailInput) => Promise<void>;
  onDeleteAlbum: (album: AdminGalleryAlbum) => Promise<void>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState({ title: "", date: "", location: "", description: "", coverImageUrl: "", titleEn: "", titleBar: "", locationEn: "", locationBar: "", descriptionEn: "", descriptionBar: "" });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  const favCount = images.filter(i => i.isFavorite).length;

  const startEdit = () => {
    setDetail({
      title: album.title,
      date: new Date(album.date).toISOString().split("T")[0],
      location: album.location,
      description: album.description,
      coverImageUrl: album.coverImageUrl || "",
      titleEn: album.titleEn || "",
      titleBar: album.titleBar || "",
      locationEn: album.locationEn || "",
      locationBar: album.locationBar || "",
      descriptionEn: album.descriptionEn || "",
      descriptionBar: album.descriptionBar || "",
    });
    setEditing(true);
  };

  const locValues: LocValues = {
    title: { de: detail.title, en: detail.titleEn, bar: detail.titleBar },
    location: { de: detail.location, en: detail.locationEn, bar: detail.locationBar },
    description: { de: detail.description, en: detail.descriptionEn, bar: detail.descriptionBar },
  };
  const handleLocChange = (key: string, lang: Lang, value: string) => {
    const suffix = lang === "de" ? "" : lang === "en" ? "En" : "Bar";
    setDetail(prev => ({ ...prev, [`${key}${suffix}`]: value }));
  };
  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const t = await translateTextsNow({ title: detail.title, location: detail.location, description: detail.description });
      setDetail(prev => ({
        ...prev,
        titleEn: t.en.title ?? prev.titleEn, titleBar: t.bar.title ?? prev.titleBar,
        locationEn: t.en.location ?? prev.locationEn, locationBar: t.bar.location ?? prev.locationBar,
        descriptionEn: t.en.description ?? prev.descriptionEn, descriptionBar: t.bar.description ?? prev.descriptionBar,
      }));
      toast.showToast("KI-Übersetzungen eingetragen – bitte prüfen und speichern.", "success");
    } catch {
      toast.showToast("Übersetzung fehlgeschlagen. Prüfe den NIM_API_KEY.", "error");
    }
    setTranslating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail.title.trim() || !detail.date || !detail.location.trim() || !detail.description.trim()) {
      toast.showToast("Bitte alle Pflichtfelder ausfüllen.", "warning");
      return;
    }
    setSaving(true);
    await onSaveAlbum(album.id, {
      title: detail.title,
      date: new Date(detail.date),
      location: detail.location,
      description: detail.description,
      coverImageUrl: detail.coverImageUrl || null,
      titleEn: detail.titleEn, titleBar: detail.titleBar,
      locationEn: detail.locationEn, locationBar: detail.locationBar,
      descriptionEn: detail.descriptionEn, descriptionBar: detail.descriptionBar,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    const created: GalleryImage[] = [];
    for (const f of pendingFiles) {
      const fd = new FormData();
      fd.append("file", f);
      const res = await uploadImage(fd);
      if (!res.success) {
        toast.showToast(`„${f.name}": ${res.error}`, "error");
        continue;
      }
      try {
        const row = await addGalleryImage(album.id, res.url, res.publicId);
        if (row) created.push(row);
      } catch (err) {
        toast.showToast(`„${f.name}": ${err instanceof Error ? err.message : "Fehler"}`, "error");
      }
    }
    if (created.length) onUploaded(album.id, created);
    setPendingFiles([]);
    setUploading(false);
  };

  return (
    <div className="bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
      {/* Header (immer sichtbar) */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpand(); } }}
      >
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-base-light shrink-0">
          {album.coverImage ? (
            <Image src={album.coverImage} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] opacity-50 text-center px-1">Kein Cover</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-base sm:text-lg truncate">{album.title}</h3>
          <p className="text-xs opacity-60 truncate">{new Date(album.date).toLocaleDateString("de-DE")} • {album.location}</p>
          <div className="flex flex-wrap gap-2 mt-1 text-[11px] font-bold">
            <span className="bg-base-light px-2 py-0.5 rounded-full">{album.imageCount} Bilder</span>
            {favCount > 0 && <span className="bg-accent-gold/15 text-accent-gold px-2 py-0.5 rounded-full">★ {favCount} Startseiten-Favorit{favCount === 1 ? "" : "en"}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {saved ? (
            <span className="w-6 h-6 rounded-full bg-accent-green text-white flex items-center justify-center" title="Gespeichert" aria-label="Gespeichert">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </span>
          ) : (
            <span className="text-xs font-bold opacity-50 min-w-6 text-center" title="Position in der Galerie-Reihenfolge">{position}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onMoveAlbum(album.id, -1); }}
            disabled={!canMoveUp}
            aria-label={`${album.title} nach vorne`}
            title="Nach vorne (Reihenfolge auf /galerie)"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-base-dark font-bold hover:bg-base-light transition-colors disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveAlbum(album.id, 1); }}
            disabled={!canMoveDown}
            aria-label={`${album.title} nach hinten`}
            title="Nach hinten (Reihenfolge auf /galerie)"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-base-dark font-bold hover:bg-base-light transition-colors disabled:opacity-30"
          >
            ↓
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteAlbum(album); }}
            aria-label={`${album.title} löschen`}
            title="Album löschen"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <svg className={`w-5 h-5 opacity-50 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-light p-4 space-y-6">
          {/* Album-Details */}
          <div>
            {!editing ? (
              <button onClick={startEdit} className="text-sm font-bold bg-base-light px-4 py-2 rounded-lg hover:bg-base-dark hover:text-white transition-colors">
                Album-Details bearbeiten
              </button>
            ) : (
              <form onSubmit={handleSave} className="space-y-3 bg-base-light/50 p-4 rounded-xl">
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-70">Datum</label>
                  <input type="date" value={detail.date} onChange={e => setDetail({ ...detail, date: e.target.value })} className="w-full border border-border-light rounded-lg p-2 bg-white focus:outline-none focus:border-accent-green text-sm" />
                </div>
                <LocalizedFields
                  fields={[
                    { key: "title", label: "Titel" },
                    { key: "location", label: "Ort" },
                    { key: "description", label: "Beschreibung", multiline: true, rows: 4 },
                  ]}
                  values={locValues}
                  onChange={handleLocChange}
                  onTranslate={handleTranslate}
                  translating={translating}
                />
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-70">Cover-Bild-URL (optional)</label>
                  <input type="url" value={detail.coverImageUrl} onChange={e => setDetail({ ...detail, coverImageUrl: e.target.value })} placeholder="https://… (leer = erstes Bild)" className="w-full border border-border-light rounded-lg p-2 bg-white focus:outline-none focus:border-accent-green text-sm" />
                  <p className="text-[11px] opacity-50 mt-1">Tipp: Cover einfach unten bei einem Bild mit „Als Cover“ setzen.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-base-light hover:bg-border-light transition-colors">Abbrechen</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-green text-white hover:bg-base-dark transition-colors disabled:opacity-50">{saving ? "Speichert…" : "Speichern"}</button>
                </div>
              </form>
            )}
          </div>

          {/* Massen-Upload */}
          <div>
            <label className="block text-xs font-bold uppercase opacity-70 mb-1">Bilder hinzufügen (Mehrfachauswahl)</label>
            <DropZone
              multiple
              accept="image/*"
              disabled={uploading}
              label={pendingFiles.length ? `${pendingFiles.length} Datei(en) ausgewählt` : "Bilder hierher ziehen oder klicken"}
              onFiles={files => setPendingFiles(prev => [...prev, ...files])}
            />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button onClick={handleUpload} disabled={uploading} className="bg-accent-green text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-base-dark transition-colors">
                  {uploading ? "Lädt hoch…" : `${pendingFiles.length} Bild(er) hochladen`}
                </button>
                <button onClick={() => setPendingFiles([])} disabled={uploading} className="text-sm font-bold opacity-60 hover:opacity-100 disabled:opacity-30">Verwerfen</button>
              </div>
            )}
          </div>

          {/* Bilder */}
          <div>
            <div className="text-xs font-bold uppercase opacity-70 mb-2">Bilder ({images.length})</div>
            {images.length === 0 ? (
              <p className="text-sm opacity-50">Noch keine Bilder — oben welche hinzufügen.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map(img => {
                  const idx = favoriteIndex.get(img.id);
                  const isCover = album.coverImage === img.imageUrl;
                  return (
                    <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light bg-base-light">
                      <Image src={img.imageUrl} alt="" fill sizes="(max-width:640px) 50vw, 20vw" className="object-cover" />
                      {/* Favorit (Stern + Index) */}
                      <button
                        onClick={() => onToggleFavorite(img.id, !img.isFavorite)}
                        title={img.isFavorite ? "Aus Startseiten-Favoriten entfernen" : "Zu Startseiten-Favoriten hinzufügen"}
                        aria-label={img.isFavorite ? "Aus Startseiten-Favoriten entfernen" : "Zu Startseiten-Favoriten hinzufügen"}
                        className={`absolute top-1.5 left-1.5 h-9 min-w-9 px-1 rounded-full font-bold flex items-center justify-center shadow text-sm transition-colors ${img.isFavorite ? "bg-accent-gold text-white" : "bg-white/90 text-base-dark hover:bg-white"}`}
                      >
                        {img.isFavorite ? `★${idx ?? ""}` : "☆"}
                      </button>
                      {/* Löschen */}
                      <button
                        onClick={() => onDeleteImage(img.id)}
                        title="Bild löschen"
                        aria-label="Bild löschen"
                        className="absolute top-1.5 right-1.5 h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                      {/* Cover */}
                      {isCover ? (
                        <span className="absolute bottom-1.5 left-1.5 bg-accent-green text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">Cover</span>
                      ) : (
                        <button
                          onClick={() => onSetCover(album.id, img.id)}
                          title="Als Album-Cover festlegen"
                          className="absolute bottom-1.5 left-1.5 right-1.5 bg-white/90 text-base-dark text-[11px] font-bold py-1.5 rounded-lg shadow hover:bg-accent-green hover:text-white transition-colors"
                        >
                          Als Cover
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}