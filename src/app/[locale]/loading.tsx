import { useTranslations } from 'next-intl';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-base-light flex flex-col items-center justify-center">
      
      {/* Logo container with breathing animation */}
      <div className="relative mb-12 animate-pulse">
        <img 
          src="/Logo.png" 
          alt="Maurer Events Logo" 
          className="h-24 md:h-32 w-auto object-contain"
        />
      </div>

      {/* Sleek Progress Bar */}
      <div className="w-48 h-1 bg-border-light rounded-full overflow-hidden">
        <div className="h-full bg-accent-green rounded-full w-1/2 animate-[pulse_1.5s_ease-in-out_infinite] origin-left scale-x-0 animate-[shimmer_1.5s_infinite] relative">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full animate-[slide_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); width: 50%; }
          100% { transform: translateX(200%); width: 50%; }
        }
      `}} />
    </div>
  );
}
