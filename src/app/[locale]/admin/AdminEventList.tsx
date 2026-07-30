"use client";

import { useState, useMemo } from "react";
import { createEvent, deleteEvent } from "@/app/actions/events";
import { uploadImage } from "@/app/actions/upload";
import Link from "next/link";

export default function AdminEventList({ initialEvents }: { initialEvents: any[] }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    endDate: "",
    location: "",
    description: "",
    imageUrl: "",
    link: "/termine/ohne-reservierung",
    reservable: false,
    minimumConsumption: 50, // Default 50€
    walkInReserve: 0, // default
    reservableDates: [] as string[]
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
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        reservableDates: formData.reservableDates,
        walkInReserve: formData.walkInReserve
      });
      setFormData({
        title: "", date: "", endDate: "", location: "", description: "", imageUrl: "", link: "/termine/ohne-reservierung", reservable: false, minimumConsumption: 50, walkInReserve: 0, reservableDates: []
      });
      setFile(null);
      window.location.reload();
    } catch (err) {
      alert("Fehler beim Speichern. Ist die Datenbank verbunden?");
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-2xl font-bold mb-4 font-display">Aktuelle Termine</h2>
        {initialEvents.map(event => (
          <Link key={event.id} href={`/admin/events/${event.id}`} className="group block bg-white p-6 rounded-2xl border border-border-light shadow-sm hover:border-accent-green hover:shadow-md transition-all relative">
            <div className="flex justify-between items-center pr-12">
              <div>
                <h3 className="font-bold text-lg font-display group-hover:text-accent-green transition-colors">{event.title}</h3>
                <p className="text-sm opacity-70 font-sans">
                  {new Date(event.date).toLocaleDateString('de-DE')} 
                  {event.endDate && event.endDate !== event.date && ` - ${new Date(event.endDate).toLocaleDateString('de-DE')}`}
                  {' | '}{event.location}
                </p>
                {event.reservable && <span className="inline-block mt-2 text-xs font-bold uppercase tracking-widest bg-base-dark text-white px-3 py-1">Reservierbar</span>}
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-accent-green font-bold text-2xl">→</span>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if(confirm("Event wirklich löschen?")) {
                    await deleteEvent(event.id);
                    window.location.reload();
                  }
                }}
                className="text-red-500 hover:text-red-700 bg-white/80 p-2 rounded-full opacity-50 hover:opacity-100 transition-opacity"
                title="Event löschen"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </Link>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-2xl border border-border-light shadow-sm h-fit">
        <h2 className="text-xl font-bold mb-6 font-display">Neues Event anlegen</h2>
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="block text-sm font-bold mb-1 opacity-70">Titel</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. Sommerfest" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold mb-1 opacity-70">Start-Datum</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
            </div>
            <div className="flex-1">
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
            <div className="flex gap-4">
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green text-sm" 
                />
                <p className="text-xs opacity-50 mt-1">Lokal hochladen</p>
              </div>
              <div className="flex items-center text-sm font-bold opacity-50">ODER</div>
              <div className="flex-1">
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
          </div>
          <div className="flex items-center gap-3 bg-base-light p-3 rounded-lg border border-border-light">
            <input 
              type="checkbox" 
              id="res" 
              className="w-5 h-5 accent-accent-green"
              checked={formData.reservable} 
              onChange={e => {
                const isReservable = e.target.checked;
                setFormData({
                  ...formData, 
                  reservable: isReservable,
                  link: isReservable ? "/termine/mit-reservierung" : "/termine/ohne-reservierung",
                  reservableDates: isReservable ? availableDays : []
                });
              }} 
            />
            <label htmlFor="res" className="text-sm font-bold cursor-pointer">Tische reservierbar?</label>
          </div>

          {formData.reservable && (
            <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg animate-fade-in space-y-4">
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
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1 opacity-70">Mindestabnahme p.P. (in €)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.minimumConsumption} 
                    onChange={e => setFormData({...formData, minimumConsumption: Number(e.target.value)})} 
                    className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" 
                  />
                </div>
                <div className="flex-1">
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
            </div>
          )}
          
          <button disabled={loading} type="submit" className="w-full bg-accent-green text-white font-bold uppercase tracking-widest py-3 rounded-lg mt-4 disabled:opacity-50 hover:bg-base-dark transition-colors">
            {loading ? "Speichert..." : "Event Speichern"}
          </button>
        </form>
      </div>
    </div>
  );
}
