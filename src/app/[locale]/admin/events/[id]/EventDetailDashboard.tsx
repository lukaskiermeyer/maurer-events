"use client";

import { useState, useMemo } from "react";
import { updateEvent } from "@/app/actions/events";
import { uploadImage } from "@/app/actions/upload";
import { assignTableToReservation, updateReservationStatus, createManualReservation } from "@/app/actions/reservations";
import { createTable, deleteTable, generateTentLayout } from "@/app/actions/tables";
import { saveTentSettings } from "@/app/actions/settings";

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 85%)`;
}

export default function EventDetailDashboard({ event, initialReservations, initialTables, tentSettings }: any) {
  const [activeTab, setActiveTab] = useState<"edit" | "reservations" | "tables">("edit");
  const [tableMode, setTableMode] = useState<"edit" | "assign">("edit");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [formData, setFormData] = useState({
    title: event.title,
    date: new Date(event.date).toISOString().split('T')[0],
    endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
    reservableDates: event.reservableDates || ([] as string[]),
    location: event.location,
    description: event.description,
    imageUrl: event.imageUrl || "",
    link: event.link,
    reservable: event.reservable,
    minimumConsumption: event.minimumConsumption / 100,
    walkInReserve: event.walkInReserve || 0
  });
  const [file, setFile] = useState<File | null>(null);

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
        ? prev.reservableDates.filter((d:string) => d !== dateStr)
        : [...prev.reservableDates, dateStr];
      return { ...prev, reservableDates: dates };
    });
  };

  const [selectedDate, setSelectedDate] = useState<string>(event.reservableDates?.[0] || "");

  // Tent Settings
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(8);

  // Generator State
  const [genW, setGenW] = useState(10);
  const [genL, setGenL] = useState(10);
  const [genCap, setGenCap] = useState(8);
  const [tentW, setTentW] = useState(tentSettings.width);
  const [tentH, setTentH] = useState(tentSettings.height);

  // Search & Filter State for Reservations
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // 'all', 'pending', 'paid', 'cancelled'
  const [filterTable, setFilterTable] = useState<string>("all"); // 'all', 'assigned', 'unassigned'

  // Manual Reservation State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualRes, setManualRes] = useState({ name: "", email: "", guests: 4 });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      alert("Bitte wähle zuerst einen Tag aus!");
      return;
    }
    setIsUpdating(true);
    await createManualReservation({
      eventId: event.id,
      guestName: manualRes.name,
      email: manualRes.email,
      guestCount: manualRes.guests,
      reservationDate: selectedDate
    });
    setManualRes({ name: "", email: "", guests: 4 });
    setShowManualForm(false);
    setIsUpdating(false);
    window.location.reload();
  };

  const handleEventUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const uploadRes = await uploadImage(uploadData);
        if (uploadRes.success) {
          finalImageUrl = uploadRes.url;
        } else {
          alert("Fehler beim Bildupload.");
          setIsUpdating(false);
          return;
        }
      }

      await updateEvent(event.id, {
        ...formData,
        imageUrl: finalImageUrl,
        date: new Date(formData.date),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        reservableDates: formData.reservableDates,
        minimumConsumption: formData.minimumConsumption * 100,
        walkInReserve: formData.walkInReserve
      });
      alert("Event erfolgreich aktualisiert!");
    } catch (err) {
      alert("Fehler beim Aktualisieren.");
    }
    setIsUpdating(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setIsUpdating(true);
    await updateReservationStatus(id, status);
    setIsUpdating(false);
  };

  const handleTableAssign = async (id: string, tableId: string) => {
    setIsUpdating(true);
    await assignTableToReservation(id, tableId === "none" ? null : tableId);
    setIsUpdating(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if(confirm("ACHTUNG: Dies löscht ALLE bestehenden Tische und generiert ein komplett neues Raster. Fortfahren?")) {
      setIsUpdating(true);
      await generateTentLayout(genW, genL, genCap);
      window.location.reload(); 
    }
  };

  const handleDrop = async (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    const resId = e.dataTransfer.getData("resId");
    if (resId) {
      await handleTableAssign(resId, tableId);
    }
  };

  const renderTableMap = (mode: "edit" | "assign") => {
    const grid = [];
    for (let y = 0; y < tentH; y++) {
      for (let x = 0; x < tentW; x++) {
        const tableHere = initialTables.find((t: any) => t.positionX === x && t.positionY === y);
        
        // Find reservations for THIS event that use this table on the selected date
        const resHere = tableHere ? initialReservations.filter((r: any) => {
          const rDate = new Date(r.reservation.reservationDate).toISOString().split('T')[0];
          return mode === "assign" 
            ? r.reservation.tableId === tableHere.id && rDate === selectedDate
            : false;
        }) : [];
        const totalGuests = resHere.reduce((sum: number, r: any) => sum + r.reservation.guestCount, 0);
        
        let bgColor = "#e5e7eb"; // light gray
        let tooltip = tableHere ? `${tableHere.name} (bis ${tableHere.capacity} Pers.)` : `Feld ${x+1}/${y+1}: Leer (Klicken zum Erstellen)`;
        
        if (mode === "assign" && tableHere) {
          if (resHere.length > 0) {
            bgColor = stringToColor(resHere[0].reservation.guestName);
            tooltip += `\nReserviert für: ${resHere.map((r:any)=>r.reservation.guestName).join(", ")} (${totalGuests} Pers.)`;
          } else {
            bgColor = "#ffffff";
          }
        }

        grid.push(
          <div 
            key={`${x}-${y}`}
            onDragOver={(e) => {
              if (mode === "assign" && tableHere) e.preventDefault();
            }}
            onDrop={(e) => {
              if (mode === "assign" && tableHere) handleDrop(e, tableHere.id);
            }}
            onClick={() => {
              if (mode === "edit") {
                if (tableHere) {
                  if (confirm(`Tisch "${tableHere.name}" wirklich löschen?`)) {
                    setIsUpdating(true);
                    deleteTable(tableHere.id).finally(() => setIsUpdating(false));
                  }
                } else {
                  const name = prompt("Name für den neuen Tisch (z.B. Tisch 5):");
                  const cap = prompt("Kapazität (Personen):", "8");
                  if (name && cap) {
                    setIsUpdating(true);
                    createTable({ name, capacity: Number(cap), positionX: x, positionY: y }).finally(() => setIsUpdating(false));
                  }
                }
              }
            }}
            title={tooltip}
            className={`
              relative flex flex-col items-center justify-center p-2 rounded-lg border-2 
              ${tableHere ? 'border-base-dark cursor-pointer hover:brightness-95 shadow-md' : 'border-dashed border-border-light cursor-crosshair hover:bg-canvas-light'}
              transition-all h-24 overflow-hidden
            `}
            style={{ backgroundColor: tableHere ? bgColor : "transparent" }}
          >
            {tableHere ? (
              <>
                <span className="font-bold text-sm text-base-dark break-words text-center leading-tight">{tableHere.name}</span>
                {mode === "assign" && resHere.length > 0 && (
                  <div className="flex flex-col items-center gap-1 mt-1 z-10">
                    {resHere.map((r: any) => (
                      <div key={r.reservation.id} className="group relative flex items-center bg-white/70 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <span className="text-[10px] font-bold truncate max-w-[60px] mr-1">{r.reservation.guestName}</span>
                        <span className="text-[10px] font-bold opacity-60">({r.reservation.guestCount})</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTableAssign(r.reservation.id, "none"); }}
                          className="hidden group-hover:flex absolute -right-1 -top-1 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] items-center justify-center shadow-sm hover:bg-red-700"
                          title="Zuweisung entfernen"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                {mode === "edit" && (
                   <span className="text-[10px] font-bold opacity-50 absolute bottom-1">Max. {tableHere.capacity}</span>
                )}
                {mode === "assign" && resHere.length === 0 && (
                   <span className="text-[10px] font-bold opacity-50 absolute bottom-1">{tableHere.capacity} Plätze</span>
                )}
              </>
            ) : (
               <span className="opacity-10 text-2xl font-bold">+</span>
            )}
          </div>
        );
      }
    }

    return (
      <div className="w-full overflow-x-auto pb-4">
        <div 
          className="grid gap-3 bg-canvas-light p-6 rounded-2xl border border-border-light min-w-max"
          style={{ gridTemplateColumns: `repeat(${tentW}, minmax(100px, 1fr))` }}
        >
          {grid}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border-light overflow-hidden mt-8">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border-light hide-scrollbar">
        <button 
          onClick={() => setActiveTab("edit")}
          className={`whitespace-nowrap px-8 py-4 font-bold font-sans transition-colors border-r border-border-light/50 ${activeTab === "edit" ? "bg-accent-green text-white" : "bg-base-light text-base-dark hover:bg-canvas-light"}`}
        >
          ✏️ Event Bearbeiten
        </button>
        <button 
          onClick={() => setActiveTab("reservations")}
          className={`whitespace-nowrap px-8 py-4 font-bold font-sans transition-colors border-r border-border-light/50 ${activeTab === "reservations" ? "bg-accent-green text-white" : "bg-base-light text-base-dark hover:bg-canvas-light"}`}
        >
          🍽️ Reservierungen ({initialReservations.length})
        </button>
        <button 
          onClick={() => setActiveTab("tables")}
          className={`whitespace-nowrap px-8 py-4 font-bold font-sans transition-colors ${activeTab === "tables" ? "bg-accent-green text-white" : "bg-base-light text-base-dark hover:bg-canvas-light"}`}
        >
          ⚙️ Tisch-Stammdaten & Zelt-Plan
        </button>
      </div>

      <div className="p-6 lg:p-10">
        
        {/* EDIT TAB */}
        {activeTab === "edit" && (
          <div className="max-w-2xl mx-auto">
            {/* Same as before */}
            <h2 className="text-2xl font-display font-bold mb-6">Event Details anpassen</h2>
            <form onSubmit={handleEventUpdate} className="space-y-4 font-sans">
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Titel</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
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
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Beschreibung</label>
                <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green min-h-[100px]" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold mb-1 opacity-70">Neues Bild hochladen (Optional)</label>
                <input type="file" accept="image/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full border border-border-light rounded-lg p-2 bg-base-light focus:outline-none focus:border-accent-green text-sm" />
              </div>
              
              <div className="flex items-center gap-3 bg-base-light p-3 rounded-lg border border-border-light mt-4">
                <input type="checkbox" id="resEdit" className="w-5 h-5 accent-accent-green" checked={formData.reservable} 
                  onChange={e => {
                    setFormData({
                      ...formData, 
                      reservable: e.target.checked,
                      reservableDates: e.target.checked ? availableDays : []
                    });
                  }} 
                />
                <label htmlFor="resEdit" className="text-sm font-bold cursor-pointer">Tische reservierbar?</label>
              </div>

              {formData.reservable && (
                <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg mt-2 space-y-4">
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
                      <input type="number" min="0" value={formData.minimumConsumption} onChange={e => setFormData({...formData, minimumConsumption: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1 opacity-70">Laufkundschaft-Puffer (Pers.)</label>
                      <input type="number" min="0" value={formData.walkInReserve} onChange={e => setFormData({...formData, walkInReserve: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" />
                    </div>
                  </div>
                </div>
              )}
              
              <button disabled={isUpdating} type="submit" className="w-full bg-accent-green text-white font-bold uppercase tracking-widest py-3 rounded-lg mt-6 disabled:opacity-50 hover:bg-base-dark transition-colors">
                {isUpdating ? "Speichert..." : "Änderungen speichern"}
              </button>
            </form>
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {activeTab === "reservations" && (
          <div className="space-y-6">
            
            {/* Day Selector */}
            {event.reservableDates && event.reservableDates.length > 0 && (
              <div className="flex overflow-x-auto gap-2 pb-2">
                {event.reservableDates.map((day: string) => (
                  <button 
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${selectedDate === day ? 'bg-accent-green text-white' : 'bg-canvas-light border border-border-light hover:border-accent-green'}`}
                  >
                    {new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-canvas-light p-4 rounded-xl border border-border-light">
              <div className="flex-1 w-full">
                <input 
                  type="text" 
                  placeholder="Suchen nach Name oder Email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 rounded border border-border-light text-sm"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="p-2 rounded border border-border-light text-sm bg-white"
                >
                  <option value="all">Alle Status</option>
                  <option value="pending">Ausstehend</option>
                  <option value="paid">Bezahlt</option>
                  <option value="cancelled">Storniert</option>
                </select>
                <select 
                  value={filterTable} 
                  onChange={(e) => setFilterTable(e.target.value)}
                  className="p-2 rounded border border-border-light text-sm bg-white"
                >
                  <option value="all">Alle Tische</option>
                  <option value="unassigned">Ohne Tisch (Neu)</option>
                  <option value="assigned">Mit Tisch</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-xl font-display font-bold">Gästeliste ({initialReservations.length})</h3>
              <button 
                onClick={() => setShowManualForm(!showManualForm)}
                className="bg-base-dark text-white text-sm px-4 py-2 rounded-lg hover:bg-accent-green transition-colors font-bold"
              >
                + Manuelle Reservierung
              </button>
            </div>

            {showManualForm && (
              <div className="bg-canvas-light border border-border-light p-6 rounded-xl mb-6 animate-fade-in">
                <h4 className="font-bold mb-4">Gast manuell eintragen (für {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE') : 'ausgewählten Tag'})</h4>
                <form onSubmit={handleManualSubmit} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Name</label>
                    <input required type="text" value={manualRes.name} onChange={e=>setManualRes({...manualRes, name: e.target.value})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" placeholder="Max Mustermann" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Email (Optional)</label>
                    <input type="email" value={manualRes.email} onChange={e=>setManualRes({...manualRes, email: e.target.value})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" placeholder="max@beispiel.de" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Personen</label>
                    <input required type="number" min="1" value={manualRes.guests} onChange={e=>setManualRes({...manualRes, guests: Number(e.target.value)})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" />
                  </div>
                  <button type="submit" disabled={isUpdating} className="bg-accent-green text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-base-dark transition-colors">
                    Speichern
                  </button>
                </form>
              </div>
            )}

            <div>
              {initialReservations.length === 0 ? (
                <p className="text-center opacity-50 py-10 bg-canvas-light rounded-xl">Noch keine Reservierungen vorhanden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="py-3 font-bold opacity-70">Gast</th>
                        <th className="py-3 font-bold opacity-70">Details</th>
                        <th className="py-3 font-bold opacity-70">Status</th>
                        <th className="py-3 font-bold opacity-70">Tisch zuweisen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialReservations
                        .filter((row: any) => {
                          // Match date
                          const rDate = new Date(row.reservation.reservationDate).toISOString().split('T')[0];
                          if (selectedDate && rDate !== selectedDate) return false;

                          const matchesSearch = row.reservation.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                row.reservation.email.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesStatus = filterStatus === "all" || row.reservation.status === filterStatus;
                          const matchesTable = filterTable === "all" || 
                                               (filterTable === "assigned" && row.reservation.tableId) ||
                                               (filterTable === "unassigned" && !row.reservation.tableId);
                          return matchesSearch && matchesStatus && matchesTable;
                        })
                        .map((row: any) => {
                        // Generate color circle for assigned guest
                        let colorBadge = null;
                        const assignedTable = initialTables.find((t:any) => t.id === row.reservation.tableId);

                        return (
                        <tr key={row.reservation.id} className="border-b border-border-light/50 hover:bg-canvas-light/50 transition-colors">
                          <td className="py-4">
                            <div className="font-bold flex items-center">
                              {row.reservation.guestName}
                              {!row.reservation.tableId ? (
                                <span className="ml-2 bg-red-100 text-red-800 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">Neu</span>
                              ) : (
                                <span className="ml-2 bg-accent-green/20 text-base-dark border border-accent-green/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                                  {assignedTable?.name || "Tisch zugewiesen"}
                                </span>
                              )}
                            </div>
                            <div className="text-xs opacity-70 ml-5">{row.reservation.email}</div>
                          </td>
                          <td className="py-4">
                            <span className="bg-canvas-light px-2 py-1 rounded font-bold">{row.reservation.guestCount} Pers.</span>
                            <div className="text-xs opacity-70 mt-1">{(row.reservation.amountTotal / 100).toFixed(2)}€</div>
                          </td>
                          <td className="py-4">
                            <select 
                              value={row.reservation.status}
                              onChange={(e) => handleStatusChange(row.reservation.id, e.target.value)}
                              disabled={isUpdating}
                              className={`border rounded p-1 text-xs font-bold ${row.reservation.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : row.reservation.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
                            >
                              <option value="pending">Ausstehend</option>
                              <option value="paid">Bezahlt</option>
                              <option value="cancelled">Storniert</option>
                            </select>
                          </td>
                          <td className="py-4">
                            <select 
                              value={row.reservation.tableId || "none"}
                              onChange={(e) => handleTableAssign(row.reservation.id, e.target.value)}
                              disabled={isUpdating}
                              className="border border-border-light rounded p-2 text-sm bg-white"
                            >
                              <option value="none">-- Kein Tisch --</option>
                              {initialTables.map((t: any) => {
                                // Check if this table is taken ON THIS SPECIFIC DATE
                                const isTaken = initialReservations.some((r:any) => {
                                  const rDate = new Date(r.reservation.reservationDate).toISOString().split('T')[0];
                                  return rDate === selectedDate && r.reservation.tableId === t.id && r.reservation.id !== row.reservation.id;
                                });
                                return (
                                  <option key={t.id} value={t.id}>
                                    {t.name} (bis {t.capacity}) {isTaken ? '⚠️' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABLES TAB */}
        {activeTab === "tables" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-display font-bold text-2xl">Zelt-Generator & Bearbeitung</h3>
              <div className="flex bg-canvas-light p-1 rounded-lg border border-border-light">
                <button 
                  onClick={() => setTableMode("edit")}
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${tableMode === "edit" ? 'bg-white shadow-sm text-base-dark' : 'text-base-dark/50 hover:text-base-dark'}`}
                >
                  🛠️ Layout bearbeiten
                </button>
                <button 
                  onClick={() => setTableMode("assign")}
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${tableMode === "assign" ? 'bg-white shadow-sm text-base-dark' : 'text-base-dark/50 hover:text-base-dark'}`}
                >
                  🎯 Gäste zuweisen
                </button>
              </div>
            </div>
            
            {tableMode === "edit" && (
              <div className="space-y-6 animate-fade-in">
                <p className="text-sm opacity-70">Erstelle ein neues Zelt-Layout. Danach kannst du durch Klicken einzelne Tische entfernen oder hinzufügen, um das Layout anzupassen.</p>
                <div className="bg-canvas-light border border-border-light p-6 rounded-2xl">
                  <form onSubmit={handleGenerate} className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Tische in Breite (Gesamt)</label>
                      <input type="number" min="2" step="2" value={genW} onChange={e=>setGenW(Number(e.target.value))} className="w-24 p-2 rounded border border-border-light bg-white" placeholder="z.B. 10" title="Muss eine gerade Zahl sein für einen symmetrischen Mittelgang" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Reihen in Länge</label>
                      <input type="number" min="1" value={genL} onChange={e=>setGenL(Number(e.target.value))} className="w-24 p-2 rounded border border-border-light bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Personen / Tisch</label>
                      <input type="number" min="1" value={genCap} onChange={e=>setGenCap(Number(e.target.value))} className="w-24 p-2 rounded border border-border-light bg-white" />
                    </div>
                    <button type="submit" disabled={isUpdating} className="bg-accent-green text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-base-dark transition-colors">
                      Zelt neu generieren
                    </button>
                  </form>
                </div>
                {renderTableMap("edit")}
              </div>
            )}

            {tableMode === "assign" && (
              <div className="space-y-6 animate-fade-in">
                {/* Day Selector for Assignment */}
                {event.reservableDates && event.reservableDates.length > 0 && (
                  <div className="flex overflow-x-auto gap-2 pb-2">
                    {event.reservableDates.map((day: string) => (
                      <button 
                        key={day}
                        onClick={() => setSelectedDate(day)}
                        className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${selectedDate === day ? 'bg-accent-green text-white' : 'bg-canvas-light border border-border-light hover:border-accent-green'}`}
                      >
                        {new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                  {/* Left Sidebar: Unassigned Reservations */}
                  <div className="xl:col-span-1 bg-canvas-light rounded-xl border border-border-light p-4 h-[600px] flex flex-col">
                    <h4 className="font-bold font-display mb-4">Noch zuzuweisen</h4>
                    <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar pr-2">
                      {initialReservations.filter((r: any) => {
                        const rDate = new Date(r.reservation.reservationDate).toISOString().split('T')[0];
                        return !r.reservation.tableId && rDate === selectedDate;
                      }).length === 0 ? (
                        <p className="text-sm opacity-50 text-center py-10">Alle Gäste für diesen Tag sind zugewiesen!</p>
                      ) : (
                        initialReservations.filter((r: any) => {
                          const rDate = new Date(r.reservation.reservationDate).toISOString().split('T')[0];
                          return !r.reservation.tableId && rDate === selectedDate;
                        }).map((r: any) => (
                          <div 
                            key={r.reservation.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("resId", r.reservation.id);
                            }}
                            className="bg-white p-3 rounded-lg border border-border-light shadow-sm cursor-grab active:cursor-grabbing hover:border-accent-green transition-colors"
                            style={{ borderLeftColor: stringToColor(r.reservation.guestName), borderLeftWidth: '4px' }}
                          >
                            <div className="font-bold text-sm leading-tight">{r.reservation.guestName}</div>
                            <div className="text-xs opacity-70 mt-1">{r.reservation.guestCount} Personen</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Right Main Area: Table Map */}
                  <div className="xl:col-span-3 overflow-x-auto bg-white rounded-xl border border-border-light p-4 h-[600px] overflow-y-auto relative">
                    <div className="absolute inset-0 p-4 min-w-max">
                      {renderTableMap("assign")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
