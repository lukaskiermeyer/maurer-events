"use client";

import { useState } from "react";
import { assignTable } from "@/app/actions/assignTable";
import { generateTableGrid } from "@/app/actions/tables";

export default function ReservationAdminMap({ tables, reservations, eventId }: { tables: any[], reservations: any[], eventId: string }) {
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [designerRows, setDesignerRows] = useState(4);
  const [designerCols, setDesignerCols] = useState(5);
  const [designerCap, setDesignerCap] = useState(8);

  const pendingReservations = reservations.filter(r => !r.tableId && r.status === 'paid');
  const assignedReservations = reservations.filter(r => r.tableId);

  const handleTableClick = async (tableId: string) => {
    if (!selectedResId) return;
    
    setIsUpdating(true);
    await assignTable(selectedResId, tableId);
    setSelectedResId(null);
    setIsUpdating(false);
  };

  const handleUnassign = async (reservationId: string) => {
    setIsUpdating(true);
    await assignTable(reservationId, null);
    setIsUpdating(false);
  };

  const handleGenerateGrid = async () => {
    if (confirm("Warnung: Alle aktuellen Tische werden gelöscht und bestehende Zuweisungen werden auf den Status 'Auszustehend' zurückgesetzt. Fortfahren?")) {
      setIsUpdating(true);
      await generateTableGrid(designerRows, designerCols, designerCap);
      setIsUpdating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      
      {/* Sidebar: Unassigned Reservations */}
      <div className="lg:col-span-1 bg-white border border-border-light rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-xl mb-4 border-b border-border-light pb-4">Auszustehend</h3>
        
        {pendingReservations.length === 0 ? (
          <p className="text-sm opacity-50">Keine offenen Zuweisungen.</p>
        ) : (
          <div className="space-y-3">
            {pendingReservations.map(res => (
              <div 
                key={res.id} 
                onClick={() => setSelectedResId(res.id === selectedResId ? null : res.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedResId === res.id ? 'border-accent-green bg-accent-green/10' : 'border-border-light hover:border-base-dark/30'}`}
              >
                <div className="font-bold">{res.guestName}</div>
                <div className="text-sm opacity-70">{res.guestCount} Personen</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="lg:col-span-3 bg-white border border-border-light rounded-3xl p-6 shadow-sm overflow-hidden relative min-h-[600px]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">Saalplan</h3>
          
          <div className="flex items-center gap-3 bg-base-light p-2 rounded-xl border border-border-light">
            <span className="text-xs font-bold text-base-dark/50 uppercase ml-2">Quick Designer</span>
            <input 
              type="number" 
              value={designerRows} 
              onChange={e => setDesignerRows(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-md text-sm border border-border-light text-center" 
              title="Reihen (Länge)"
            />
            <span className="text-xs font-bold">x</span>
            <input 
              type="number" 
              value={designerCols} 
              onChange={e => setDesignerCols(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-md text-sm border border-border-light text-center"
              title="Spalten (Breite)"
            />
            <input 
              type="number" 
              value={designerCap} 
              onChange={e => setDesignerCap(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-md text-sm border border-border-light text-center ml-2"
              title="Sitzplätze pro Tisch"
            />
            <button 
              onClick={handleGenerateGrid}
              className="bg-accent-green text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-base-dark transition-colors"
            >
              Generieren
            </button>
          </div>
        </div>
        
        {isUpdating && (
          <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center backdrop-blur-sm">
            <span className="font-bold">Speichere...</span>
          </div>
        )}

        <div className="relative w-full h-[800px] border-2 border-dashed border-border-light rounded-xl bg-canvas-light">
          {tables.map(table => {
            const tableReservations = assignedReservations.filter(r => r.tableId === table.id);
            const totalGuestsAssigned = tableReservations.reduce((sum, r) => sum + r.guestCount, 0);
            const isFull = totalGuestsAssigned >= table.capacity;
            
            return (
              <div 
                key={table.id}
                onClick={() => handleTableClick(table.id)}
                className={`group absolute p-2 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center
                  ${selectedResId ? 'hover:scale-110 hover:border-accent-green hover:shadow-lg' : ''}
                  ${isFull ? 'bg-red-50 border-red-200' : 'bg-white border-border-light'}
                `}
                style={{ 
                  left: `${table.positionX}%`, 
                  top: `${table.positionY}%`,
                  width: '80px',
                  height: '80px',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <span className="font-bold text-sm block mb-1">{table.name}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isFull ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {totalGuestsAssigned}/{table.capacity}
                </span>

                {/* Tooltip for assigned guests */}
                {tableReservations.length > 0 && (
                  <div className="absolute top-full mt-2 w-48 bg-base-dark text-white text-xs p-3 rounded-lg opacity-0 hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                    {tableReservations.map(r => (
                      <div key={r.id} className="flex justify-between items-center mb-1">
                        <span>{r.guestName} ({r.guestCount})</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUnassign(r.id); }}
                          className="text-red-400 hover:text-red-300 ml-2 font-bold pointer-events-auto"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
