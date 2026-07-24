"use client";

import { useState } from "react";
import { createEvent, deleteEvent } from "@/app/actions/events";

export default function AdminEventList({ initialEvents }: { initialEvents: any[] }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    location: "",
    description: "",
    imageUrl: "",
    link: "/termine/ohne-reservierung",
    reservable: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createEvent({
        ...formData,
        date: new Date(formData.date)
      });
      setFormData({
        title: "", date: "", location: "", description: "", imageUrl: "", link: "/termine/ohne-reservierung", reservable: false
      });
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
          <div key={event.id} className="bg-white p-6 rounded-2xl border border-border-light shadow-sm flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg font-display">{event.title}</h3>
              <p className="text-sm opacity-70 font-sans">{new Date(event.date).toLocaleDateString('de-DE')} | {event.location}</p>
              {event.reservable && <span className="inline-block mt-2 text-xs font-bold uppercase tracking-widest bg-base-dark text-white px-3 py-1">Reservierbar</span>}
            </div>
            <button 
              onClick={async () => {
                if(confirm("Event wirklich löschen?")) {
                  await deleteEvent(event.id);
                  window.location.reload();
                }
              }}
              className="text-red-600 text-sm font-bold hover:underline"
            >
              Löschen
            </button>
          </div>
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
          <div>
            <label className="block text-sm font-bold mb-1 opacity-70">Bild-URL (Optional)</label>
            <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. https://unsplash.com/..." />
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
                  link: isReservable ? "/termine/mit-reservierung" : "/termine/ohne-reservierung"
                });
              }} 
            />
            <label htmlFor="res" className="text-sm font-bold cursor-pointer">Tische reservierbar?</label>
          </div>
          
          <button disabled={loading} type="submit" className="w-full bg-accent-green text-white font-bold uppercase tracking-widest py-3 rounded-lg mt-4 disabled:opacity-50 hover:bg-base-dark transition-colors">
            {loading ? "Speichert..." : "Event Speichern"}
          </button>
        </form>
      </div>
    </div>
  );
}
