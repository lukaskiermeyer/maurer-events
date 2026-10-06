"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error securely to the console/reporting service
    // Der User sieht diese Details nicht auf dem Bildschirm!
    console.error("Kritischer Systemfehler:", error);
  }, [error]);

  return (
    <html lang="de">
      <head>
        <title>Ein Fehler ist aufgetreten | MAURER EVENTS</title>
      </head>
      <body className="bg-[#121212] text-[#E0E0E0] min-h-screen m-0 p-0 font-sans selection:bg-red-500/30 selection:text-white">
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center max-w-2xl mx-auto">
            <div className="mb-8 relative flex justify-center">
              <AlertTriangle className="w-24 h-24 text-red-500/80 drop-shadow-[0_0_30px_rgba(239,68,68,0.3)]" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
              Kritischer Systemfehler
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-lg mx-auto">
              Beim Laden der Anwendung ist ein schwerwiegender Fehler aufgetreten. Aus Sicherheitsgründen zeigen wir keine technischen Details, unser Team wurde aber bereits informiert.
            </p>

            <button
              onClick={() => reset()}
              className="group relative flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-8 py-4 rounded-2xl hover:bg-red-500/20 transition-all active:scale-95"
            >
              <RefreshCw className="w-5 h-5 transition-transform duration-500 hover:rotate-180" />
              <span>Anwendung neu laden</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
