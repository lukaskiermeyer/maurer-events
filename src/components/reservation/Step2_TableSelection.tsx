"use client";

import { useTranslations } from "next-intl";

export default function Step2_TableSelection({
  tables,
  bookedTableIds,
  selectedTableId,
  setSelectedTableId,
  isCountdown,
  publishTablesAt,
  setIsWaitlistMode,
  isLoadingTables = false
}: {
  tables: any[];
  bookedTableIds: string[];
  selectedTableId: string;
  setSelectedTableId: (id: string) => void;
  isCountdown: boolean;
  publishTablesAt?: string;
  setIsWaitlistMode: (val: boolean) => void;
  isLoadingTables?: boolean;
}) {
  const t = useTranslations("Reservation");

  if (isCountdown) {
    return (
      <div className="animate-fade-in bg-canvas-light p-8 rounded-2xl text-center border border-border-light">
        <h4 className="text-xl font-bold mb-2 text-base-dark">Reservierungen noch nicht freigeschaltet</h4>
        <p className="text-base-dark/70 mb-4">Die Tischauswahl öffnet sich am {publishTablesAt ? new Date(publishTablesAt).toLocaleString('de-DE') : ''}.</p>
      </div>
    );
  }

  if (isLoadingTables) {
    return (
      <div className="animate-fade-in">
        <h3 className="text-2xl font-bold mb-6 text-base-dark">Tisch auswählen</h3>
        <div className="bg-canvas-light p-4 md:p-6 rounded-2xl border border-border-light w-full">
          <div className="grid grid-cols-3 gap-2 mx-auto animate-pulse max-w-sm">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white/50 border border-border-light rounded-xl h-[80px] w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tables.length > 0 && bookedTableIds.length >= tables.length) {
    return (
      <div className="animate-fade-in">
        <h3 className="text-2xl font-bold mb-6 text-base-dark">Tisch auswählen</h3>
        <div className="bg-red-50 border border-red-200 rounded-3xl p-10 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold text-base-dark mb-2">Alle Tische sind ausgebucht!</h4>
          <p className="text-base-dark/70 text-sm mb-6 max-w-sm mx-auto">Für dieses Datum sind leider keine Tische mehr verfügbar. Trage dich in die Warteliste ein, und wir melden uns, falls ein Tisch frei wird.</p>
          <button 
            onClick={() => setIsWaitlistMode(true)}
            className="bg-accent-green text-white font-bold py-3 px-8 rounded-xl hover:bg-base-dark transition-colors"
          >
            Auf die Warteliste
          </button>
        </div>
      </div>
    );
  }

  const maxX = tables.length > 0 ? Math.max(...tables.map(table => table.positionX)) : 0;
  const maxY = tables.length > 0 ? Math.max(...tables.map(table => table.positionY)) : 0;

  const selectedTableObj = tables.find(table => table.id === selectedTableId);

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold mb-6 text-base-dark">Tisch auswählen</h3>
      
      <div className="bg-canvas-light p-4 md:p-6 rounded-2xl border border-border-light w-full overflow-x-auto">
        <div className="min-w-max mx-auto" role="radiogroup" aria-label="Tisch auswählen">
          <div 
            className="w-full" 
            style={{
              display: 'grid',
              // Desktop: größere Boxen (80px), Mobile: kompakte Boxen (60px) für minimales Scrollen
              gridTemplateColumns: `repeat(${maxX + 1}, minmax(60px, 1fr))`,
              gridTemplateRows: `repeat(${maxY + 1}, minmax(60px, 1fr))`,
              gap: '8px'
            }}
          >
            {tables.map(table => {
              const isBooked = bookedTableIds.includes(table.id);
              const isSelected = selectedTableId === table.id;
              
              let bg = isBooked 
                ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed' 
                : isSelected 
                  ? 'bg-accent-green/20 border-accent-green ring-1 ring-accent-green shadow-sm z-10 scale-105' 
                  : table.isVip 
                    ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                    : 'bg-white border-border-light hover:border-accent-green/50';

              const shortName = table.name.replace(/Tisch\s*/i, 'T');
              const statusText = isBooked ? 'belegt' : 'frei';
              const ariaLabel = `${table.name}, ${table.capacity} Personen, ${statusText}`;

              return (
                <button
                  key={table.id}
                  disabled={isBooked}
                  onClick={() => setSelectedTableId(table.id)}
                  style={{ gridColumn: table.positionX + 1, gridRow: table.positionY + 1 }}
                  className={`border rounded-xl p-1 md:p-2 transition-all flex flex-col items-center justify-center text-center relative ${bg} min-h-[60px] md:min-h-[80px] md:min-w-[80px]`}
                  title={`${table.name} (${table.capacity} Personen)`}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={ariaLabel}
                >
                  <span className={`font-black text-[11px] md:text-sm leading-tight ${isBooked ? 'text-red-900' : 'text-base-dark'}`}>
                    <span className="md:hidden">{shortName}</span>
                    <span className="hidden md:inline">{table.name}</span>
                  </span>
                  
                  <span className={`text-[8px] md:text-[10px] mt-0.5 ${isBooked ? 'text-red-700' : 'text-base-dark/70'}`}>
                    {table.capacity} <span className="hidden md:inline">Pers.</span>
                  </span>
                  
                  <div className="flex gap-0.5 md:gap-1 mt-1 flex-wrap justify-center">
                    {table.isVip && !isBooked && (
                      <span className="text-[7px] md:text-[9px] font-bold bg-yellow-400 text-yellow-900 px-1 rounded uppercase">VIP</span>
                    )}
                    {isBooked && (
                      <span className="text-[7px] md:text-[9px] font-bold bg-red-100 text-red-700 px-1 rounded uppercase border border-red-200">X</span>
                    )}
                    {isSelected && (
                      <span className="text-[7px] md:text-[9px] font-bold bg-accent-green text-white px-1 rounded uppercase">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-base-dark/60 justify-center">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white border border-border-light rounded-sm"></div> Frei</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-50 border border-yellow-300 rounded-sm"></div> VIP</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-50 border border-red-200 rounded-sm"></div> Belegt</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-accent-green/10 border-2 border-accent-green rounded-sm"></div> Gewählt</div>
        </div>
      </div>

      <div className="mt-8 text-center border-t border-border-light pt-6">
        <button 
          onClick={() => setIsWaitlistMode(true)}
          className="text-sm font-bold text-base-dark/60 underline hover:text-accent-green transition-colors min-h-[48px] px-4"
        >
          {t('waitlist_btn')}
        </button>
      </div>

      {/* Floating Selected Table Info (Mobile) */}
      {selectedTableObj && (
        <div className="fixed bottom-[calc(var(--bottom-bar-height)+16px)] left-4 right-4 z-40 bg-base-dark text-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex justify-between items-center animate-fade-in lg:hidden border border-white/10">
          <div>
            <span className="block text-[10px] font-bold opacity-70 uppercase tracking-widest text-accent-green mb-0.5">Ausgewählt</span>
            <span className="font-black text-lg">{selectedTableObj.name}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] font-bold opacity-70 uppercase tracking-widest text-accent-green mb-0.5">Kapazität</span>
            <span className="font-black text-lg">{selectedTableObj.capacity} <span className="text-sm font-normal opacity-80">Pers.</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
