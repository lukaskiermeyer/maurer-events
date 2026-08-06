"use client";

import React, { useState, useEffect } from "react";
import { Scanner } from '@yudiel/react-qr-scanner';
import { scanTicket } from "@/app/actions/scanner";
import { Link } from "@/i18n/routing";

export default function AdminScanPage() {
  const [scanResult, setScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleScan = async (result: any) => {
    if (!result || !result[0] || !result[0].rawValue || isProcessing) return;
    const qrCodeText = result[0].rawValue;
    
    setIsProcessing(true);
    const res = await scanTicket(qrCodeText);
    setScanResult(res);
    setIsProcessing(false);
  };

  const resetScanner = () => {
    setScanResult(null);
  };

  if (!isClient) return null; // Avoid hydration mismatch on camera render

  return (
    <div className="min-h-screen bg-base-dark text-white flex flex-col pt-24 pb-12 px-4">
      <div className="max-w-[600px] w-full mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-display font-black text-white">Ticket <span className="text-accent-green">Scanner</span></h1>
          <Link href="/admin" className="text-sm font-bold bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
            Zurück
          </Link>
        </div>

        {scanResult ? (
          <div className="bg-canvas-light text-base-dark p-8 rounded-3xl text-center shadow-2xl animate-fade-in border-4 border-transparent" style={{ borderColor: scanResult.success ? '#10b981' : '#ef4444' }}>
            {scanResult.success ? (
              <>
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-black mb-2 text-green-600">Erfolgreich!</h2>
                <p className="font-bold text-lg mb-6 opacity-70">{scanResult.message}</p>
                
                <div className="bg-white p-6 rounded-2xl text-left shadow-sm border border-border-light space-y-4 mb-8">
                  <div>
                    <span className="block text-xs uppercase font-bold opacity-50 mb-1">Gast</span>
                    <span className="text-xl font-black">{scanResult.data.guestName}</span>
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <span className="block text-xs uppercase font-bold opacity-50 mb-1">Personen</span>
                      <span className="text-lg font-bold">{scanResult.data.guestCount}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs uppercase font-bold opacity-50 mb-1">Tisch</span>
                      <span className="text-lg font-bold text-accent-green">{scanResult.data.tableName}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-3xl font-black mb-4 text-red-600">Fehler!</h2>
                <p className="font-bold text-xl mb-8 bg-red-50 p-4 rounded-xl border border-red-100">{scanResult.error}</p>
              </>
            )}

            <button 
              onClick={resetScanner}
              className="w-full bg-base-dark text-white font-bold text-lg py-4 rounded-xl hover:bg-accent-green transition-colors"
            >
              Nächstes Ticket scannen
            </button>
          </div>
        ) : (
          <div className="bg-canvas-light p-4 rounded-3xl shadow-2xl relative overflow-hidden">
            {isProcessing && (
              <div className="absolute inset-0 bg-base-dark/80 z-10 flex items-center justify-center backdrop-blur-sm">
                <div className="text-white font-bold text-xl animate-pulse">Ticket wird geprüft...</div>
              </div>
            )}
            <div className="rounded-2xl overflow-hidden aspect-square md:aspect-[4/3] bg-black">
              <Scanner onScan={handleScan} />
            </div>
            <p className="text-center text-base-dark/70 font-bold mt-4 mb-2 text-sm">
              Halte den QR Code in die Kamera, um das Ticket zu entwerten.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
