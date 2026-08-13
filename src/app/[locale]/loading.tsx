import { useTranslations } from 'next-intl';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-base-light flex flex-col items-center justify-center overflow-hidden">
      
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Logo Container */}
        <div className="relative mb-16 animate-[float_4s_ease-in-out_infinite]">
          <img 
            src="/Logo.png" 
            alt="Maurer Events Logo" 
            className="relative z-10 h-24 md:h-32 w-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* Minimalist Progress Line */}
        <div className="w-48 h-[2px] bg-border-light rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-accent-green rounded-full w-1/3 animate-[shimmer_1.5s_infinite_ease-in-out]"></div>
        </div>
        
        <span className="text-base-dark/40 text-xs font-bold tracking-[0.3em] uppercase mt-6 animate-pulse">
          Lädt...
        </span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); width: 20%; }
          50% { transform: translateX(100%); width: 50%; }
          100% { transform: translateX(300%); width: 20%; }
        }
      `}} />
    </div>
  );
}
