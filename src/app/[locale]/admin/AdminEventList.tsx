"use client";

import type { EventRecord, AdminStats } from '@/types/domain';

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createEvent, deleteEvent, updateEvent, getEventDeletionSummary, restoreEvent, getDeletedEvents } from "@/app/actions/events";
import { uploadImage } from "@/lib/client-image-upload";
import { Link } from "@/i18n/routing";
import MarkdownEditor from "@/components/admin/MarkdownEditor";
import { useToast } from "@/components/ui/Toast";
import { reservationBadge, resolveReservationMode } from "@/lib/reservation-mode";

export default function AdminEventList({ initialEvents, stats }: { initialEvents: EventRecord[], stats?: AdminStats }) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedEvents, setDeletedEvents] = useState<EventRecord[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    endDate: "",
    location: "",
    zip: "",
    description: "",
    imageUrl: "",
    mapUrl: "",
    link: "/termine/ohne-reservierung",
    reservable: false,
    allowTableSelection: true,
    reservationMode: "none",
    reservationEmail: "servus@maurer-events.com",
    reservationNote: "",
    maxCapacity: 0,
    walkInReserve: 0, // default
    reservableDates: [] as string[],
    publishTablesAt: "", // ISO String
    isPublished: true
  });

  const availableDays = useMemo(() => {
    if (!formData.date) return [];
    const startD = new Date(formData.date);
    const endD = formData.endDate ? new Date(formData.endDate) : new Date(formData.date);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return [];

    const days = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    return days;
  }, [formData.date, formData.endDate]);

  const toggleReservableDate = (dateStr: string) => {
    setFormData(prev => {
      const dates = prev.reservableDates.includes(dateStr)
        ? prev.reservableDates.filter(d => d !== dateStr)
        : [...prev.reservableDates, dateStr];
      return { ...prev, reservableDates: dates };
    });
  };

  const removeImage = () => {
    setFile(null);
    setFormData(current => ({ ...current, imageUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setFormData({
      title: "", date: "", endDate: "", location: "", zip: "", description: "", imageUrl: "", mapUrl: "", link: "/termine/ohne-reservierung", reservable: false, allowTableSelection: true, reservationMode: "none", reservationEmail: "servus@maurer-events.com", reservationNote: "", maxCapacity: 0, walkInReserve: 0, reservableDates: [], publishTablesAt: "", isPublished: true
    });
    setFile(null);
    setEditingEvent(null);
    setStep(1);
  };

  const startEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || "",
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
      location: event.location || "",
      zip: event.zip || "",
      description: event.description || "",
      imageUrl: event.imageUrl || "",
      mapUrl: event.mapUrl || "",
      link: event.link || "/termine/ohne-reservierung",
      reservable: event.reservable ?? false,
      allowTableSelection: event.allowTableSelection ?? true,
      reservationMode: (event.reservationMode as 'none' | 'email' | 'online') || 'none',
      reservationEmail: event.reservationEmail || "servus@maurer-events.com",
      reservationNote: event.reservationNote || "",
      maxCapacity: event.maxCapacity || 0,
      walkInReserve: event.walkInReserve || 0,
      reservableDates: event.reservableDates || [],
      publishTablesAt: event.publishTablesAt ? new Date(event.publishTablesAt).toISOString().slice(0, 16) : "",
      isPublished: event.isPublished ?? true
    });
    setFile(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateStep = (s: number): string | null => {
    const stepsToCheck = s === 4 ? [1, 2, 3, 4] : [s];
    for (const stepNum of stepsToCheck) {
      if (stepNum === 1) {
        if (!formData.title.trim()) return "Bitte einen Titel eingeben.";
        if (!formData.date) return "Bitte ein Startdatum eingeben.";
        if (!formData.location.trim()) return "Bitte einen Ort eingeben.";
        if (!formData.description.trim()) return "Bitte eine Beschreibung eingeben.";
      }
      if (stepNum === 2) {
        if (!formData.zip.trim()) return "Bitte eine PLZ eingeben.";
      }
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) { toast.showToast(err, "warning"); return; }
    if (step < 4) setStep(step + 1);
  };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter in an input must not skip the remaining steps.
    if (step < 4) { nextStep(); return; }
    const err = validateStep(4);
    if (err) { toast.showToast(err, "warning"); return; }
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
          const uploadMsg = uploadRes.error || "Unbekannter Fehler";
          if (uploadMsg.includes("nicht konfiguriert") || uploadMsg.includes("forbidden") || uploadMsg.includes("403")) {
            toast.showToast("Bildupload fehlgeschlagen: Cloudinary ist nicht korrekt konfiguriert. Bitte Administrator kontaktieren.", "error");
          } else if (uploadMsg.includes("zu groß") || uploadMsg.includes("groß")) {
            toast.showToast("Bildupload fehlgeschlagen: Die Datei ist zu groß. Bitte wähle ein kleineres Bild (max. 10 MB).", "error");
          } else {
            toast.showToast("Bildupload fehlgeschlagen: " + uploadMsg, "error");
          }
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        reservationMode: formData.reservationMode as 'none' | 'email' | 'online',
        reservable: formData.reservationMode === 'online',
        imageUrl: finalImageUrl,
        zip: formData.zip || undefined,
        mapUrl: formData.mapUrl || undefined,
        isPublished: formData.isPublished,
        date: new Date(formData.date),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        reservableDates: formData.reservableDates,
        allowTableSelection: formData.allowTableSelection,
        maxCapacity: formData.maxCapacity,
        walkInReserve: formData.walkInReserve,
        publishTablesAt: formData.publishTablesAt ? new Date(formData.publishTablesAt) : undefined
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.showToast("Event erfolgreich aktualisiert!", "success");
      } else {
        await createEvent(payload);
        toast.showToast("Event erfolgreich angelegt!", "success");
      }
      resetForm();
      router.refresh();
    } catch {
      toast.showToast("Fehler beim Speichern. Ist die Datenbank verbunden?", "error");
    }
    setLoading(false);
  };

  const toggleDeleted = async () => {
    if (!showDeleted) {
      setLoadingDeleted(true);
      try {
        const list = await getDeletedEvents();
        setDeletedEvents(list.filter(e => e.type === 'event'));
      } catch {
        toast.showToast("Fehler beim Laden der gelöschten Events.", "error");
      }
      setLoadingDeleted(false);
    }
    setShowDeleted(!showDeleted);
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreEvent(id);
      setDeletedEvents(prev => prev.filter(e => e.id !== id));
      toast.showToast("Event wiederhergestellt.", "success");
      router.refresh();
    } catch (err) {
      toast.showToast("Fehler beim Wiederherstellen: " + (err instanceof Error ? err.message : ""), "error");
    }
  };

  const stepLabels = ["Grunddaten", "Ort & Karte", "Reservierung", "Einstellungen"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 min-w-0 [&>div]:min-w-0">
      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-border-light shadow-sm text-center">
              <div className="text-3xl font-black text-accent-green mb-1">{stats.totalEvents}</div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider">Events Gesamt</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border-light shadow-sm text-center">
              <div className="text-3xl font-black text-accent-green mb-1">{stats.reservableEvents}</div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider">Davon online reservierbar</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border-light shadow-sm text-center">
              <div className="text-3xl font-black text-accent-green mb-1">{stats.totalReservations}</div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider">Reservierungen</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border-light shadow-sm text-center">
              <div className="text-3xl font-black text-accent-green mb-1">{stats.revenue.toLocaleString('de-DE')}€</div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider">Umsatz (Bezahlt)</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-yellow-300 shadow-sm text-center">
              <div className="text-3xl font-black text-yellow-600 mb-1">{stats.devShare.toLocaleString('de-DE')}€</div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider text-yellow-800">Dev Share (VIP)</div>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-4 font-display">Aktuelle Termine</h2>
        {initialEvents.map(event => (
          <div key={event.id} className="group bg-white rounded-2xl border border-border-light shadow-sm hover:border-accent-green hover:shadow-md transition-all">
            <div className="flex items-start gap-3 p-5">
              <Link href={`/admin/events/${event.id}`} className="flex-1 min-w-0 block">
                <div className="min-w-0">
                  <h3 className="text-lg font-subhead group-hover:text-accent-green transition-colors break-words">{event.title}</h3>
                  <p className="text-sm opacity-70 font-sans break-words">
                    {new Date(event.date).toLocaleDateString('de-DE')}
                    {event.endDate && event.endDate !== event.date && ` - ${new Date(event.endDate).toLocaleDateString('de-DE')}`}
                    {' | '}{event.location}{event.zip ? ` · ${event.zip}` : ""}
                  </p>
                  {(() => {
                    const badge = reservationBadge(resolveReservationMode(event), 'de');
                    return badge ? (
                      <span className="inline-block mt-2 text-xs font-bold uppercase tracking-widest bg-base-dark text-white px-3 py-1">{badge}</span>
                    ) : null;
                  })()}
                </div>
              </Link>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startEdit(event);
                  }}
                  className="text-accent-green hover:text-accent-green/80 bg-white/80 min-h-11 min-w-11 flex items-center justify-center rounded-full border border-border-light"
                  title="Event bearbeiten"
                  aria-label={`${event.title} bearbeiten`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                     try {
                       const summary = await getEventDeletionSummary(event.id);
                       const parts = [];
                       if (summary.reservations > 0) parts.push(`${summary.reservations} Reservierung(en)`);
                       if (summary.galleries > 0) parts.push(`${summary.galleries} Galeriebild(er)`);
                       if (summary.waitlists > 0) parts.push(`${summary.waitlists} Wartelisteneintrag/-einträge`);
                       const detail = parts.length ? `\nVerknüpft: ${parts.join(", ")}.` : "";
                       const msg = `Event "${event.title}" wirklich löschen?${detail}\n\nEs wird zuerst nur als gelöscht markiert und kann innerhalb von 7 Tagen wiederhergestellt werden. Danach wird es endgültig gelöscht.`;
                       if (!confirm(msg)) return;
                       await deleteEvent(event.id);
                       toast.showToast("Event gelöscht (wiederherstellbar innerhalb von 7 Tagen).", "success");
                       router.refresh();
                     } catch (err) {
                       toast.showToast("Fehler beim Löschen: " + (err instanceof Error ? err.message : ""), "error");
                     }
                  }}
                  className="text-red-500 hover:text-red-700 bg-white/80 min-h-11 min-w-11 flex items-center justify-center rounded-full border border-border-light"
                  title="Event löschen"
                  aria-label={`${event.title} löschen`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Papierkorb */}
        <div className="lg:col-span-2 space-y-4">
          <button
            type="button"
            onClick={toggleDeleted}
            className="text-sm font-bold text-base-dark/60 hover:text-accent-green underline"
          >
            {showDeleted ? "Papierkorb ausblenden" : "Gelöschte Events anzeigen"}
          </button>
          {showDeleted && (
            <div className="space-y-3">
              {loadingDeleted ? (
                <p className="text-sm opacity-50">Lädt...</p>
              ) : deletedEvents.length === 0 ? (
                <p className="text-sm opacity-50">Keine gelöschten Events.</p>
              ) : (
                deletedEvents.map(event => (
                  <div key={event.id} className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg break-words">{event.title}</h3>
                      <p className="text-sm opacity-70">{new Date(event.date).toLocaleDateString('de-DE')} | {event.location}</p>
                      <p className="text-xs opacity-50">Gelöscht am: {event.deletedAt ? new Date(event.deletedAt).toLocaleString('de-DE') : "-"}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(event.id)}
                      className="bg-accent-green text-white font-bold px-4 py-2 rounded-lg hover:bg-base-dark transition-colors text-sm"
                    >
                      Wiederherstellen
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm h-fit">
        <h2 className="text-xl font-bold mb-6 font-display">
          {editingEvent ? "Event bearbeiten" : "Neues Event anlegen"}
        </h2>
        {editingEvent && (
          <button type="button" onClick={resetForm} className="mb-4 text-sm font-bold text-accent-green hover:underline">
            ← Abbrechen / Neues Event
          </button>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i + 1 <= step ? 'bg-accent-green text-white' : 'bg-canvas-light text-base-dark/40'}`}>
                {i + 1}
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`h-0.5 w-6 sm:w-10 ${i + 1 < step ? 'bg-accent-green' : 'bg-border-light'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm font-bold text-center mb-4 text-base-dark/60">Schritt {step} von 4: {stepLabels[step - 1]}</p>

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          {/* Step 1: Grunddaten */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Titel *</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Sommerfest" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">Start-Datum *</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">End-Datum (Optional)</label>
                  <input type="date" min={formData.date} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
              </div>
              <MarkdownEditor label="Beschreibung *" value={formData.description} onChange={value => setFormData({ ...formData, description: value })} placeholder="Kurze Event-Beschreibung..." collapsedByDefault={false} />
              <div className="space-y-2">
                <label className="block text-sm font-bold mb-1 opacity-70">Bild / Flyer</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(true); }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(false); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingImage(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped && dropped.type.startsWith("image/")) setFile(dropped);
                    }}
                    className={`relative flex-1 min-w-0 border-2 border-dashed rounded-lg p-3 text-center transition-colors ${isDraggingImage ? "border-accent-green bg-accent-green/10" : "border-border-light bg-base-light"}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <p className="text-xs opacity-60 pointer-events-none">
                      {isDraggingImage ? "Bild hier ablegen…" : (file ? file.name : "Bild hierher ziehen oder klicken")}
                    </p>
                    <p className="text-xs opacity-50 mt-1 pointer-events-none">Lokal hochladen</p>
                  </div>
                  <div className="flex items-center text-sm font-bold opacity-50">ODER</div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green"
                      placeholder="Bild-URL (z.B. unsplash.com/...)"
                      disabled={file !== null}
                    />
                  </div>
                </div>
                {(file || formData.imageUrl) && (
                  <div className="mt-2 relative inline-block">
                    <p className="text-xs font-bold text-base-dark/60 mb-1">{file ? "Vorschau (wird beim Speichern hochgeladen):" : "Aktuelles Bild:"}</p>
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file ? URL.createObjectURL(file) : formData.imageUrl} alt="Vorschau" className="max-h-32 rounded-lg border border-border-light" />
                      <button
                        type="button"
                        onClick={removeImage}
                        aria-label="Bild entfernen"
                        title="Bild entfernen"
                        className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Ort & Karte */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Ort *</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Schwaig" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">PLZ *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5} value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. 93149" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Maps-Link (optional)</label>
                <input
                  type="url"
                  value={formData.mapUrl}
                  onChange={e => setFormData({...formData, mapUrl: e.target.value})}
                  className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green"
                  placeholder="https://maps.google.com/... oder Google Maps Link"
                />
                <p className="text-xs opacity-50 mt-1">Link zu Google Maps (Standort des Events). Wird im Eventbereich als Karte angezeigt.</p>
              </div>
            </>
          )}

          {/* Step 3: Reservierung */}
          {step === 3 && (
            <>
              <div className="space-y-2 bg-base-light p-3 rounded-lg border border-border-light">
                <label htmlFor="res" className="block text-sm font-bold">Reservierungsmodus</label>
                <select
                  id="res"
                  value={formData.reservationMode}
                  onChange={e => {
                    const mode = e.target.value;
                    setFormData({
                      ...formData,
                      reservationMode: mode,
                      reservable: mode === 'online',
                      link: mode === 'online' ? "/termine/mit-reservierung" : "/termine/ohne-reservierung",
                      reservableDates: mode === 'none' ? [] : formData.reservableDates
                    });
                  }}
                  className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                >
                  <option value="none">Keine Reservierung</option>
                  <option value="email">Reservierung per E-Mail</option>
                </select>
                <p className="text-xs opacity-60">Online-Reservierungen sind derzeit nur für bestehende Events aktiv.</p>
              </div>

              {formData.reservationMode === 'email' && (
                <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg animate-fade-in space-y-3">
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Reservierungs-E-Mail</label>
                    <input
                      type="email"
                      required
                      value={formData.reservationEmail}
                      onChange={e => setFormData({ ...formData, reservationEmail: e.target.value })}
                      className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Hinweis für Gäste (optional)</label>
                    <textarea
                      value={formData.reservationNote}
                      onChange={e => setFormData({ ...formData, reservationNote: e.target.value })}
                      className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green min-h-[80px]"
                      placeholder="z.B. Reservierungen nur für Vereine ab 20 Personen."
                    />
                  </div>
                </div>
              )}

              {formData.reservable && (
                <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg animate-fade-in space-y-4">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-border-light mb-4">
                    <input
                      type="checkbox"
                      id="tableSel"
                      className="w-5 h-5 accent-accent-green"
                      checked={formData.allowTableSelection}
                      onChange={e => setFormData({...formData, allowTableSelection: e.target.checked})}
                    />
                    <label htmlFor="tableSel" className="text-sm font-bold cursor-pointer">Zelt-Layout & Tischauswahl aktivieren?</label>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Welche Tage sind reservierbar?</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {availableDays.length === 0 ? (
                        <span className="text-xs opacity-50">Bitte wähle zuerst ein Datum.</span>
                      ) : (
                        availableDays.map(day => (
                          <label key={day} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-border-light text-sm cursor-pointer hover:border-accent-green">
                            <input
                              type="checkbox"
                              checked={formData.reservableDates.includes(day)}
                              onChange={() => toggleReservableDate(day)}
                              className="accent-accent-green"
                            />
                            {new Date(day).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="block text-sm font-bold mb-1 opacity-70">Laufkundschaft-Puffer (Pers.)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.walkInReserve}
                        onChange={e => setFormData({...formData, walkInReserve: Number(e.target.value)})}
                        className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                        title="Anzahl an Plätzen, die immer für Spontanbesucher reserviert bleiben."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1 opacity-70">Tisch-Layout freischalten ab (Datum & Uhrzeit)</label>
                    <input
                      type="datetime-local"
                      value={formData.publishTablesAt}
                      onChange={e => setFormData({...formData, publishTablesAt: e.target.value})}
                      className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                      title="Ab wann sollen Kunden Tische sehen und buchen können? Leer lassen für sofort."
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 4: Einstellungen */}
          {step === 4 && (
            <>
              <div className="flex items-center gap-3 bg-base-light p-3 rounded-lg border border-border-light">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished}
                  onChange={e => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-5 h-5 accent-accent-green"
                />
                <label htmlFor="isPublished" className="text-sm font-bold cursor-pointer">Event ist live (auf der Website sichtbar)</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">Max. Kapazität (0=unlimitiert)</label>
                  <input type="number" min="0" value={formData.maxCapacity} onChange={e => setFormData({...formData, maxCapacity: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">Laufkundschaft-Puffer (Pers.)</label>
                  <input type="number" min="0" value={formData.walkInReserve} onChange={e => setFormData({...formData, walkInReserve: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t border-border-light">
            {step > 1 && (
              <button type="button" onClick={prevStep} className="bg-white border border-border-light text-base-dark font-bold px-6 py-3 rounded-lg hover:border-accent-green transition-colors">
                ← Zurück
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={nextStep} className="bg-accent-green text-white font-bold px-6 py-3 rounded-lg hover:bg-base-dark transition-colors ml-auto">
                Weiter →
              </button>
            ) : (
              <button disabled={loading} type="submit" className="bg-accent-green text-white font-bold uppercase tracking-widest px-6 py-3 rounded-lg disabled:opacity-50 hover:bg-base-dark transition-colors ml-auto">
                {loading ? "Speichert..." : (editingEvent ? "Event aktualisieren" : "Event Speichern")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}