"use client";

import { useTranslations } from "next-intl";

export default function Step3_TimePackage({
  times,
  packages,
  selectedTime,
  selectedPackage,
  guests,
  selectedTableObj,
  setSelectedTime,
  setSelectedPackage,
  setGuests,
  requireFullTable
}: {
  times: string[];
  packages: any[];
  selectedTime: string;
  selectedPackage: string;
  guests: number;
  selectedTableObj: any;
  setSelectedTime: (time: string) => void;
  setSelectedPackage: (pkg: string) => void;
  setGuests: (g: number) => void;
  requireFullTable?: boolean;
}) {
  const t = useTranslations("Reservation");

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold mb-6 text-base-dark">Uhrzeit & Paket</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div>
          <label id="time-label" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Uhrzeit</label>
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-labelledby="time-label">
            {times.map(time => (
              <button 
                key={time}
                onClick={() => setSelectedTime(time)}
                role="radio"
                aria-checked={selectedTime === time}
                className={`min-h-[56px] py-4 text-sm font-bold rounded-xl border transition-all ${selectedTime === time ? 'bg-accent-green text-white border-accent-green shadow-md scale-105' : 'border-border-light hover:border-accent-green/50 bg-white text-base-dark hover:bg-canvas-light'}`}
              >
                {time.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">
            Gästezahl {selectedTableObj ? `(Max ${selectedTableObj.capacity})` : ''}
          </label>
          <div className="flex items-center gap-4 bg-white border border-border-light rounded-xl p-2 h-[56px]">
            <button 
              onClick={() => setGuests(Math.max(1, guests - 1))} 
              disabled={requireFullTable && !!selectedTableObj}
              className="w-12 h-12 flex items-center justify-center hover:bg-canvas-light transition-colors rounded-lg text-2xl font-normal text-base-dark disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Gästezahl verringern"
            >
              -
            </button>
            <span className="flex-1 text-center font-bold text-xl text-base-dark" aria-live="polite">{guests}</span>
            <button 
              onClick={() => setGuests(Math.min(selectedTableObj?.capacity || 100, guests + 1))} 
              disabled={requireFullTable && !!selectedTableObj}
              className="w-12 h-12 flex items-center justify-center hover:bg-canvas-light transition-colors rounded-lg text-2xl font-normal text-base-dark disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Gästezahl erhöhen"
            >
              +
            </button>
          </div>
          {requireFullTable && selectedTableObj && (
            <p className="text-[10px] text-accent-green font-bold uppercase mt-2 opacity-70">
              Für diesen Event muss die gesamte Tischkapazität gebucht werden.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4" role="radiogroup" aria-labelledby="package-label">
        <label id="package-label" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Konsumations-Paket</label>
        {packages.map(pkg => (
          <button 
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg.id)}
            role="radio"
            aria-checked={selectedPackage === pkg.id}
            className={`w-full text-left p-6 rounded-2xl border transition-all relative ${selectedPackage === pkg.id ? 'bg-accent-green/10 border-accent-green ring-1 ring-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white hover:bg-canvas-light'}`}
          >
            {pkg.popular && (
              <span className="absolute -top-3 right-6 bg-accent-green text-white text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-sm">
                {t('popular')}
              </span>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
              <h4 className="font-bold text-xl text-base-dark">{pkg.name}</h4>
              <span className="font-black text-accent-green text-lg bg-accent-green/10 px-3 py-1 rounded-lg">
                {pkg.price}€ <span className="text-xs font-normal opacity-70 text-base-dark">p.P.</span>
              </span>
            </div>
            <p className="text-base text-base-dark/70 leading-relaxed max-w-xl">{pkg.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
