"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventRecord, AdminGalleryAlbum, GalleryImage, GalleryWithAlbum } from "@/types/domain";
import {
  createGalleryAlbum, updateGalleryAlbum, deleteGalleryAlbum, restoreGalleryAlbum,
  getDeletedGalleryAlbums, getOrCreateEventAlbum, removeGalleryImage, setGalleryFavorite,
  moveGalleryFavorite, moveGalleryAlbum, setAlbumCoverFromImage, assignGalleryImage, getGalleryImages,
} from "@/app/actions/gallery";
import { uploadImage } from "@/lib/client-image-upload";
import { translateTextsNow } from "@/app/actions/translations";
import LocalizedFields, { type Lang, type LocValues } from "@/components/admin/LocalizedFields";
import DropZone from "@/components/ui/DropZone";
import AdminAlbumCard, { type AlbumDetailInput } from "./AdminAlbumCard";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";

const MAX_FAVORITES = 8;
const EMPTY_CREATE = { title: "", date: "", location: "", description: "", coverImageUrl: "", titleEn: "", titleBar: "", locationEn: "", locationBar: "", descriptionEn: "", descriptionBar: "" };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler");

export default function AdminGalleryTab({
  albums,
  convertibleEvents,
  initialGallery = [],
}: {
  albums: AdminGalleryAlbum[];
  convertibleEvents: EventRecord[];
  initialGallery?: GalleryWithAlbum[];
}) {
  const toast = useToast();
  const dialog = useDialog();

  const [albumList, setAlbumList] = useState<AdminGalleryAlbum[]>(albums);
  const [imageList, setImageList] = useState<GalleryImage[]>(() => initialGallery.map(x => x.gallery));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedAlbums, setDeletedAlbums] = useState<AdminGalleryAlbum[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_CREATE });
  const [createCoverFile, setCreateCoverFile] = useState<File | null>(null);
  const [createTranslating, setCreateTranslating] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [savedMark, setSavedMark] = useState<{ kind: "album" | "fav"; id: string } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  // Kurzes Speicher-Icon nach Reihenfolge-Änderung (Album oder Favoriten-Foto).
  const markSaved = (kind: "album" | "fav", id: string) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedMark({ kind, id });
    savedTimer.current = setTimeout(() => setSavedMark(null), 1500);
  };

  // Favoriten (geordnet) + Index-Lookup für die Badges an den Bildern.
  const favorites = useMemo(
    () => imageList.filter(i => i.isFavorite).sort((a, b) => a.favoriteOrder - b.favoriteOrder),
    [imageList]
  );
  const favoriteIndex = useMemo(() => {
    const m = new Map<string, number>();
    favorites.forEach((f, i) => m.set(f.id, i + 1));
    return m;
  }, [favorites]);

  const imagesByAlbum = useMemo(() => {
    const m = new Map<string, GalleryImage[]>();
    for (const img of imageList) {
      if (!img.albumId) continue;
      const arr = m.get(img.albumId);
      if (arr) arr.push(img); else m.set(img.albumId, [img]);
    }
    return m;
  }, [imageList]);

  const poolImages = useMemo(() => imageList.filter(i => !i.albumId), [imageList]);

  // Gleiche Reihenfolge wie öffentlich auf /galerie: manuelle Ordnung, dann Datum absteigend.
  const sortedAlbums = useMemo(() => [...albumList].sort((a, b) => {
    const o = a.sortOrder - b.sortOrder;
    if (o !== 0) return o;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  }), [albumList]);

  const pastEventsWithoutAlbum = convertibleEvents.filter(e => {
    const end = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return end < new Date() && !albumList.some(a => a.eventId === e.id);
  });

  const patchImage = (id: string, patch: Partial<GalleryImage>) =>
    setImageList(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const patchAlbum = (album: AdminGalleryAlbum) =>
    setAlbumList(prev => prev.map(a => (a.id === album.id ? album : a)));

  // ---- Aktionen (alle ohne Page-Reload) ----

  const handleToggleFavorite = async (imageId: string, next: boolean) => {
    if (next && !favoriteIndex.has(imageId) && favorites.length >= MAX_FAVORITES) {
      toast.showToast(`Maximal ${MAX_FAVORITES} Favoriten für die Startseite.`, "warning");
      return;
    }
    try {
      const updated = await setGalleryFavorite(imageId, next);
      if (updated) patchImage(imageId, { isFavorite: updated.isFavorite, favoriteOrder: updated.favoriteOrder });
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleMoveFavorite = async (imageId: string, dir: -1 | 1) => {
    try {
      const list = await moveGalleryFavorite(imageId, dir);
      setImageList(prev => prev.map(i => {
        const hit = list.find(x => x.id === i.id);
        return hit ? { ...i, favoriteOrder: hit.favoriteOrder } : i;
      }));
      markSaved("fav", imageId);
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleMoveAlbum = async (albumId: string, dir: -1 | 1) => {
    try {
      const list = await moveGalleryAlbum(albumId, dir);
      setAlbumList(prev => prev.map(a => {
        const hit = list.find(x => x.id === a.id);
        return hit ? { ...a, sortOrder: hit.sortOrder } : a;
      }));
      markSaved("album", albumId);
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!await dialog.confirm({ title: "Bild löschen", message: "Bild wirklich löschen?", danger: true, confirmLabel: "Löschen" })) return;
    try {
      await removeGalleryImage(imageId);
      setImageList(prev => prev.filter(i => i.id !== imageId));
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleSetCover = async (albumId: string, imageId: string) => {
    try {
      const album = await setAlbumCoverFromImage(albumId, imageId);
      if (album) patchAlbum(album);
      toast.showToast("Cover gesetzt.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleUploaded = (albumId: string, rows: GalleryImage[]) => {
    setImageList(prev => [...rows, ...prev]);
    setAlbumList(prev => prev.map(a => a.id === albumId
      ? { ...a, imageCount: a.imageCount + rows.length, coverImage: a.coverImage || rows[0]?.imageUrl || null }
      : a));
  };

  const handleSaveAlbum = async (albumId: string, data: AlbumDetailInput) => {
    try {
      const album = await updateGalleryAlbum(albumId, data);
      if (album) patchAlbum(album);
      toast.showToast("Album gespeichert.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleDeleteAlbum = async (album: AdminGalleryAlbum) => {
    const imgCount = imagesByAlbum.get(album.id)?.length ?? 0;
    const detail = imgCount > 0 ? `\nVerknüpft: ${imgCount} Galeriebild(er).` : "";
    const msg = `Album „${album.title}" wirklich löschen?${detail}\n\nEs wird zuerst nur als gelöscht markiert und kann innerhalb von 7 Tagen wiederhergestellt werden. Danach wird es endgültig entfernt.`;
    if (!await dialog.confirm({ title: "Album löschen", message: msg, danger: true, confirmLabel: "Löschen" })) return;
    try {
      await deleteGalleryAlbum(album.id);
      setAlbumList(prev => prev.filter(a => a.id !== album.id));
      setImageList(prev => prev.filter(i => i.albumId !== album.id));
      if (showDeleted) setDeletedAlbums(prev => [album, ...prev]);
      if (expandedId === album.id) setExpandedId(null);
      toast.showToast("Album gelöscht.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleRestore = async (id: string) => {
    try {
      const album = await restoreGalleryAlbum(id);
      const imgs = await getGalleryImages(id);
      if (album) setAlbumList(prev => [album, ...prev]);
      setImageList(prev => [...imgs, ...prev]);
      setDeletedAlbums(prev => prev.filter(a => a.id !== id));
      toast.showToast("Album wiederhergestellt.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const toggleDeleted = async () => {
    const next = !showDeleted;
    if (next && deletedAlbums.length === 0) {
      setLoadingDeleted(true);
      try { setDeletedAlbums(await getDeletedGalleryAlbums()); }
      catch { toast.showToast("Fehler beim Laden der gelöschten Alben.", "error"); }
      setLoadingDeleted(false);
    }
    setShowDeleted(next);
  };

  const handleAssign = async (imageId: string, albumId: string) => {
    if (!albumId) return;
    try {
      await assignGalleryImage(imageId, albumId);
      setImageList(prev => prev.map(i => (i.id === imageId ? { ...i, albumId } : i)));
      setAlbumList(prev => prev.map(a => (a.id === albumId ? { ...a, imageCount: a.imageCount + 1 } : a)));
      toast.showToast("Bild zugeordnet.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handleCreateFromEvent = async (event: EventRecord) => {
    if (!await dialog.confirm({ title: "Album aus Event erstellen", message: `Ein Galerie-Album aus „${event.title}" erstellen? Titel, Datum, Ort und Beschreibung werden kopiert. Das Event bleibt erhalten.`, confirmLabel: "Album erstellen" })) return;
    setBusyEventId(event.id);
    try {
      const album = await getOrCreateEventAlbum(event.id);
      if (album) setAlbumList(prev => [album, ...prev]);
      toast.showToast("Album erstellt.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
    setBusyEventId(null);
  };

  const openCreate = () => { setCreateForm({ ...EMPTY_CREATE }); setCreateCoverFile(null); setIsCreateOpen(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.date || !createForm.location.trim() || !createForm.description.trim()) {
      toast.showToast("Bitte alle Pflichtfelder ausfüllen.", "warning");
      return;
    }
    setCreateSaving(true);
    try {
      let coverUrl = createForm.coverImageUrl;
      if (createCoverFile) {
        const fd = new FormData(); fd.append("file", createCoverFile);
        const res = await uploadImage(fd);
        if (res.success) coverUrl = res.url;
        else { toast.showToast("Fehler beim Cover-Upload: " + res.error, "error"); setCreateSaving(false); return; }
      }
      const album = await createGalleryAlbum({
        title: createForm.title,
        date: new Date(createForm.date),
        location: createForm.location,
        description: createForm.description,
        coverImageUrl: coverUrl || null,
        titleEn: createForm.titleEn, titleBar: createForm.titleBar,
        locationEn: createForm.locationEn, locationBar: createForm.locationBar,
        descriptionEn: createForm.descriptionEn, descriptionBar: createForm.descriptionBar,
      });
      if (album) setAlbumList(prev => [album, ...prev]);
      setIsCreateOpen(false);
      toast.showToast("Album erstellt.", "success");
    } catch (err) { toast.showToast(errMsg(err), "error"); }
    setCreateSaving(false);
  };

  const createLocValues: LocValues = {
    title: { de: createForm.title, en: createForm.titleEn, bar: createForm.titleBar },
    location: { de: createForm.location, en: createForm.locationEn, bar: createForm.locationBar },
    description: { de: createForm.description, en: createForm.descriptionEn, bar: createForm.descriptionBar },
  };
  const handleCreateLocChange = (key: string, lang: Lang, value: string) => {
    const suffix = lang === "de" ? "" : lang === "en" ? "En" : "Bar";
    setCreateForm(prev => ({ ...prev, [`${key}${suffix}`]: value }));
  };
  const handleCreateTranslate = async () => {
    setCreateTranslating(true);
    try {
      const t = await translateTextsNow({ title: createForm.title, location: createForm.location, description: createForm.description });
      setCreateForm(prev => ({
        ...prev,
        titleEn: t.en.title ?? prev.titleEn, titleBar: t.bar.title ?? prev.titleBar,
        locationEn: t.en.location ?? prev.locationEn, locationBar: t.bar.location ?? prev.locationBar,
        descriptionEn: t.en.description ?? prev.descriptionEn, descriptionBar: t.bar.description ?? prev.descriptionBar,
      }));
      toast.showToast("KI-Übersetzungen eingetragen – bitte prüfen und speichern.", "success");
    } catch { toast.showToast("Übersetzung fehlgeschlagen. Prüfe den NIM_API_KEY.", "error"); }
    setCreateTranslating(false);
  };

  return (
    <div className="relative min-h-[500px] pb-24 space-y-8">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-subhead text-2xl text-base-dark">Galerie verwalten</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleDeleted} className="inline-flex items-center gap-2 bg-white border border-border-light text-base-dark font-bold px-4 py-3 rounded-xl shadow-sm hover:bg-base-light transition-colors text-sm">
            {showDeleted ? "Papierkorb ausblenden" : "Papierkorb"}
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 bg-accent-green text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-base-dark transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Neues Album
          </button>
        </div>
      </div>

      {/* Startseiten-Favoriten (Reihenfolge der 8 Best-of-Bilder) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h4 className="font-subhead text-xl">Startseiten-Favoriten ({favorites.length}/{MAX_FAVORITES})</h4>
          <span className="text-xs font-bold opacity-60">Reihenfolge = Anzeige auf der Startseite · Sterne an den Album-Bildern vergeben</span>
        </div>
        {favorites.length === 0 ? (
          <p className="text-sm opacity-60">Noch keine Favoriten. Klappe ein Album auf und markiere Bilder mit dem Stern ☆.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {favorites.map((fav, i) => {
              const owner = albumList.find(a => a.id === fav.albumId);
              return (
                <div key={fav.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light bg-base-light group">
                  <Image src={fav.imageUrl} alt="" fill sizes="12vw" className="object-cover" />
                  <span className="absolute top-1 left-1 bg-accent-green text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                    {savedMark?.kind === "fav" && savedMark.id === fav.id ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Gespeichert"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : i + 1}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-black/55 p-1 text-base">
                    <button onClick={() => handleMoveFavorite(fav.id, -1)} disabled={i === 0} className="text-white disabled:opacity-30 min-w-7" aria-label="Nach vorne" title="Nach vorne">↑</button>
                    <button onClick={() => handleMoveFavorite(fav.id, 1)} disabled={i === favorites.length - 1} className="text-white disabled:opacity-30 min-w-7" aria-label="Nach hinten" title="Nach hinten">↓</button>
                    <button onClick={() => handleToggleFavorite(fav.id, false)} className="text-red-300 min-w-7" aria-label="Aus Favoriten entfernen" title="Aus Favoriten entfernen">×</button>
                  </div>
                  {owner && <span className="absolute top-1 right-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full max-w-[70%] truncate">{owner.title}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Papierkorb */}
      {showDeleted && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border-light shadow-sm">
          <h4 className="mb-4 font-subhead text-xl">Gelöschte Alben (7 Tage wiederherstellbar)</h4>
          {loadingDeleted ? <p className="text-sm opacity-50">Lädt…</p>
            : deletedAlbums.length === 0 ? <p className="text-sm opacity-50">Keine gelöschten Alben.</p>
            : (
              <div className="space-y-3">
                {deletedAlbums.map(album => (
                  <div key={album.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 border border-border-light rounded-xl">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{album.title}</div>
                      <div className="text-xs opacity-70">{new Date(album.date).toLocaleDateString("de-DE")} • {album.location} • {album.imageCount} Bilder</div>
                    </div>
                    <button onClick={() => handleRestore(album.id)} className="shrink-0 text-sm bg-base-light px-4 py-2 rounded-lg font-bold hover:bg-accent-green hover:text-white transition-colors">Wiederherstellen</button>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Reihenfolge = Anzeige auf /galerie */}
      <div className="flex justify-end">
        <span className="text-xs font-bold opacity-60">Reihenfolge = Anzeige auf der Galerie-Seite · mit ↑/↓ am Album ändern</span>
      </div>

      {/* Alben (ausklappbar) */}
      <div className="space-y-4">
        {sortedAlbums.map((album, i) => (
          <AdminAlbumCard
            key={album.id}
            album={album}
            position={i + 1}
            canMoveUp={i > 0}
            canMoveDown={i < sortedAlbums.length - 1}
            onMoveAlbum={handleMoveAlbum}
            saved={savedMark?.kind === "album" && savedMark.id === album.id}
            images={imagesByAlbum.get(album.id) ?? []}
            favoriteIndex={favoriteIndex}
            expanded={expandedId === album.id}
            onToggleExpand={() => setExpandedId(prev => (prev === album.id ? null : album.id))}
            onToggleFavorite={handleToggleFavorite}
            onDeleteImage={handleDeleteImage}
            onSetCover={handleSetCover}
            onUploaded={handleUploaded}
            onSaveAlbum={handleSaveAlbum}
            onDeleteAlbum={handleDeleteAlbum}
          />
        ))}
        {albumList.length === 0 && (
          <div className="py-16 text-center opacity-50 bg-white rounded-2xl border border-border-light shadow-sm">
            Noch keine Galerie-Alben. Erstelle ein Album oder wandle ein vergangenes Event um.
          </div>
        )}
      </div>

      {/* Bilder ohne Album (Pool) */}
      {poolImages.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border-light shadow-sm">
          <h4 className="mb-1 font-subhead text-xl">Bilder ohne Album ({poolImages.length})</h4>
          <p className="text-sm opacity-60 mb-4">Diese Bilder sind keinem Album zugeordnet. Ordne sie unten einem Album zu.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {poolImages.map(img => (
              <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light bg-base-light">
                <Image src={img.imageUrl} alt="" fill sizes="(max-width:768px) 50vw, 20vw" className="object-cover" />
                <button
                  onClick={() => handleToggleFavorite(img.id, !img.isFavorite)}
                  title={img.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
                  aria-label={img.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
                  className={`absolute top-1.5 left-1.5 h-9 min-w-9 px-1 rounded-full font-bold flex items-center justify-center shadow text-sm ${img.isFavorite ? "bg-accent-gold text-white" : "bg-white/90 text-base-dark"}`}
                >
                  {img.isFavorite ? `★${favoriteIndex.get(img.id) ?? ""}` : "☆"}
                </button>
                <button onClick={() => handleDeleteImage(img.id)} title="Bild löschen" aria-label="Bild löschen" className="absolute top-1.5 right-1.5 h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600">×</button>
                {albumList.length > 0 && (
                  <select
                    value=""
                    onChange={e => handleAssign(img.id, e.target.value)}
                    className="absolute bottom-1.5 left-1.5 right-1.5 bg-white/95 text-base-dark text-[11px] font-bold rounded-lg p-1.5 shadow outline-none border border-border-light"
                    aria-label="Album zuordnen"
                  >
                    <option value="" disabled>Album zuordnen…</option>
                    {sortedAlbums.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Album aus vergangenem Event */}
      {pastEventsWithoutAlbum.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border-light shadow-sm">
          <h4 className="mb-1 font-subhead text-xl">Album aus Event erstellen</h4>
          <p className="text-sm opacity-70 mb-4">Vergangene Events ohne Album. Ein Klick kopiert Titel, Datum, Ort und Beschreibung in ein neues Galerie-Album — das Event bleibt erhalten.</p>
          <div className="space-y-3">
            {pastEventsWithoutAlbum.map(event => (
              <div key={event.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 border border-border-light rounded-xl hover:border-accent-green transition-colors">
                <div className="min-w-0">
                  <div className="font-bold truncate">{event.title}</div>
                  <div className="text-xs opacity-70">{new Date(event.date).toLocaleDateString("de-DE")} • {event.location}</div>
                </div>
                <button onClick={() => handleCreateFromEvent(event)} disabled={busyEventId === event.id} className="shrink-0 text-sm bg-base-light px-4 py-2 rounded-lg font-bold hover:bg-accent-green hover:text-white transition-colors disabled:opacity-50">
                  {busyEventId === event.id ? "Erstellt…" : "Album erstellen"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button aria-label="Galerie-Album erstellen" onClick={openCreate} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-accent-green text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 hover:shadow-2xl transition-all z-40">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </button>

      {/* Create-Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-label="Galerie-Album erstellen" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-border-light flex justify-between items-center gap-3 z-10">
              <h2 className="text-xl font-bold font-display">Galerie-Album erstellen</h2>
              <button aria-label="Dialog schließen" onClick={() => setIsCreateOpen(false)} className="p-2 min-h-11 min-w-11 shrink-0 hover:bg-base-light rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 sm:p-6 space-y-4 font-sans">
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Datum</label>
                <input required type="date" value={createForm.date} onChange={e => setCreateForm({ ...createForm, date: e.target.value })} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
              </div>
              <LocalizedFields
                fields={[
                  { key: "title", label: "Titel" },
                  { key: "location", label: "Ort" },
                  { key: "description", label: "Beschreibung", multiline: true, rows: 4 },
                ]}
                values={createLocValues}
                onChange={handleCreateLocChange}
                onTranslate={handleCreateTranslate}
                translating={createTranslating}
              />
              <div className="space-y-2">
                <label className="block text-sm font-bold mb-1 opacity-70">Cover-Bild (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <DropZone accept="image/*" label={createCoverFile ? createCoverFile.name : "Bild hierher ziehen oder klicken"} onFiles={files => setCreateCoverFile(files[0] || null)} />
                    {createCoverFile && (/* eslint-disable-line @next/next/no-img-element */ <img src={URL.createObjectURL(createCoverFile)} alt="Vorschau" className="mt-2 max-h-32 rounded-lg border border-border-light" />)}
                  </div>
                  <div className="min-w-0">
                    <input type="url" value={createForm.coverImageUrl} onChange={e => setCreateForm({ ...createForm, coverImageUrl: e.target.value })} placeholder="oder Bild-URL (https://…)" className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green text-sm" disabled={createCoverFile !== null} />
                  </div>
                </div>
                <p className="text-xs opacity-50">Ohne Cover wird automatisch das erste Bild des Albums verwendet.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 bg-base-light text-base-dark font-bold py-3 rounded-xl hover:bg-border-light transition-colors">Abbrechen</button>
                <button type="submit" disabled={createSaving} className="flex-1 bg-accent-green text-white font-bold py-3 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">{createSaving ? "Speichert…" : "Album erstellen"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}