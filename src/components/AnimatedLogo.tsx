"use client";

import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

export default function AnimatedLogo({ className = "w-24 h-24" }: { className?: string }) {
  // Temporarily disabled useRive to prevent the "Bad Header" crash 
  // since the file festwirt_hero.riv is currently 0 bytes.
  // Uncomment this once the real file is in the public folder.
  
  /*
  const { RiveComponent } = useRive({
    src: '/festwirt_hero.riv',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });
  */

  return (
    <div className={`${className} flex items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/20 p-2`}>
      <span className="text-white/30 text-[10px] uppercase font-bold text-center leading-tight">Rive Logo<br/>Platzhalter</span>
    </div>
  );
}
