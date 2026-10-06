"use client";

import { useState, useEffect, useRef } from "react";
import { checkInGuestByQR } from "@/app/actions/reservations";
import TicketQrScanner from "@/components/admin/TicketQrScanner";
import { Link } from "@/i18n/routing";

export default function ScannerClient({ eventId }: { eventId: string }) {
  const [resultMessage, setResultMessage] = useState<{ type: "success" | "error" | "info", text: string, details?: string } | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const scanLocked = useRef(false);

  const resumeScanning = () => {
    scanLocked.current = false;
    setResultMessage(null);
    setIsScanning(true);
  };

  // We want to re-enable scanning a few seconds after a successful/error scan
  useEffect(() => {
    if (resultMessage && (resultMessage.type === "success" || resultMessage.type === "error")) {
      const timer = setTimeout(() => {
        resumeScanning();
      }, 5000); // 5 seconds cooldown
      return () => clearTimeout(timer);
    }
  }, [resultMessage]);

  const handleScan = async (text: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    
    setIsScanning(false);
    setResultMessage({ type: "info", text: "Verarbeite..." });

    try {
      const res = await checkInGuestByQR(eventId, text);
      if (res.success) {
        setResultMessage({ 
          type: "success", 
          text: "Zugang gewährt!",
          details: `${res.guestName} (${res.guestCount} Pers.) - ${res.tableName}`
        });
      } else {
        setResultMessage({ 
          type: "error", 
          text: res.error || "Unbekannter Fehler"
        });
      }
    } catch {
      setResultMessage({ type: "error", text: "Netzwerkfehler beim Scannen" });
    }
  };

  return (
    <div className="min-h-screen bg-base-dark text-white flex flex-col">
      <div className="p-4 bg-black/50 flex items-center justify-between">
        <Link href={`/admin/events/${eventId}`} className="text-accent-green font-bold">
          &larr; Zurück
        </Link>
        <h1 className="text-lg font-black tracking-wider uppercase">Einlass Scanner</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Scanner Window */}
        <div className="w-full max-w-md aspect-square bg-black rounded-3xl overflow-hidden relative border-4 border-base-light/10 shadow-2xl">
          <TicketQrScanner onScan={handleScan} paused={!isScanning} />
          
          {/* Overlay when processing or showing result */}
          {resultMessage && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md transition-colors z-10 ${
              resultMessage.type === "success" ? "bg-accent-green/90" : 
              resultMessage.type === "error" ? "bg-red-500/90" : "bg-black/80"
            }`}>
              <h2 className="text-3xl font-black mb-2 text-white drop-shadow-md">
                {resultMessage.text}
              </h2>
              {resultMessage.details && (
                <p className="text-lg font-bold text-white/90 drop-shadow-md">
                  {resultMessage.details}
                </p>
              )}
              
              {(resultMessage.type === "success" || resultMessage.type === "error") && (
                <button 
                  onClick={resumeScanning}
                  className="mt-8 px-6 py-3 bg-black/40 hover:bg-black/60 rounded-full font-bold uppercase tracking-wider text-sm transition-colors text-white"
                >
                  Weiter scannen
                </button>
              )}
            </div>
          )}
        </div>
        
        <p className="mt-8 text-base-light/60 text-center text-sm max-w-xs">
          Halte den QR-Code des Tickets in das Kamerafeld. Der Code wird automatisch gescannt.
        </p>
      </div>
    </div>
  );
}
