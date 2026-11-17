"use client";

import type { EventRecord, AdminStats } from '@/types/domain';

import { useState, useMemo } from "react";
import { createEvent, deleteEvent, updateEvent } from "@/app/actions/events";
import { uploadImage } from "@/lib/client-image-upload";
import { Link } from "@/i18n/routing";
import { reservationBadge, resolveReservationMode } from "@/lib/reservation-mode";

export default function AdminEventList({ initialEvents, stats }: { initialEvents: EventRecord[], stats?: AdminStats }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    endDate: "",
    location: "",
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

  const resetForm = () => {
    setFormData({
      title: "", date: "", endDate: "", location: "", description: "", imageUrl: "", mapUrl: "", link: "/termine/ohne-reservierung", reservable: false, allowTableSelection: true, reservationMode: "none", reservationEmail: "servus@maurer-events.com", reservationNote: "", maxCapacity: 0, walkInReserve: 0, reservableDates: [], publishTablesAt: "", isPublished: true
    });
    setFile(null);
    setEditingEvent(null);
  };

  const startEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || "",
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
      location: event.location || "",
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

      const payload = {
        ...formData,
        reservationMode: formData.reservationMode as 'none' | 'email' | 'online',
        reservable: formData.reservationMode === 'online',
        imageUrl: finalImageUrl,
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
        alert("Event erfolgreich aktualisiert!");
      } else {
        await createEvent(payload);
        alert("Event erfolgreich angelegt!");
      }
      resetForm();
      window.location.reload();
    } catch {
      alert("Fehler beim Speichern. Ist die Datenbank verbunden?");
    }
    setLoading(false);
  };

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
          <div key={event.id} className="group bg-white rounded-2xl border border-border-light shadow-sm hover:border-accent-green hover:shadow-md transition-all relative">
            <Link href={`/admin/events/${event.id}`} className="block p-5 pr-16">
              <div className="min-w-0">
                <h3 className="font-bold text-lg font-display group-hover:text-accent-green transition-colors break-words">{event.title}</h3>
                <p className="text-sm opacity-70 font-sans break-words">
                  {new Date(event.date).toLocaleDateString('de-DE')} 
                  {event.endDate && event.endDate !== event.date && ` - ${new Date(event.endDate).toLocaleDateString('de-DE')}`}
                  {' | '}{event.location}
                </p>
                {(() => {
                  const badge = reservationBadge(resolveReservationMode(event), 'de');
                  return badge ? (
                    <span className="inline-block mt-2 text-xs font-bold uppercase tracking-widest bg-base-dark text-white px-3 py-1">{badge}</span>
                  ) : null;
                })()}
              </div>
            </Link>
            
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startEdit(event);
                }}
                className="text-accent-green hover:text-accent-green/80 bg-white/80 min-h-11 min-w-11 flex items-center justify-center rounded-full"
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
                  if(confirm("Event wirklich löschen?")) {
                    await deleteEvent(event.id);
                    window.location.reload();
                  }
                }}
                className="text-red-500 hover:text-red-700 bg-white/80 min-h-11 min-w-11 flex items-center justify-center rounded-full"
                title="Event löschen"
                aria-label={`${event.title} löschen`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
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
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="block text-sm font-bold mb-1 opacity-70">Titel</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Sommerfest" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-sm font-bold mb-1 opacity-70">Start-Datum</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-bold mb-1 opacity-70">End-Datum (Optional)</label>
              <input type="date" min={formData.date} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
            </div>
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
            {file && (
              <div className="mt-2">
                <p className="text-xs font-bold text-base-dark/60 mb-1">Vorschau (wird beim Speichern hochgeladen):</p>
                {/* eslint-disable-line @next/next/no-img-element */}<img src={URL.createObjectURL(file)} alt="Vorschau" className="max-h-32 rounded-lg border border-border-light" />
              </div>
            )}
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
          
          <button disabled={loading} type="submit" className="w-full bg-accent-green text-white font-bold uppercase tracking-widest py-3 rounded-lg mt-4 disabled:opacity-50 hover:bg-base-dark transition-colors">
            {loading ? "Speichert..." : (editingEvent ? "Event aktualisieren" : "Event Speichern")}
          </button>
        </form>
      </div>
    </div>
  );
}
