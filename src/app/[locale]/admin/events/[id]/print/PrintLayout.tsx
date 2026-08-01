"use client";

import { useEffect, ReactNode } from "react";

export default function PrintLayout({ 
  children, 
  eventTitle, 
  eventDate 
}: { 
  children: ReactNode;
  eventTitle: string;
  eventDate: string;
}) {
  
  useEffect(() => {
    // Small delay to ensure rendering is complete before print dialog opens
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white min-h-screen text-black print:bg-white print:m-0 print:p-0">
      <div className="max-w-[21cm] mx-auto p-8 print:p-0 print:max-w-none">
        
        {/* Print Header */}
        <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight">Tischreservierungen</h1>
            <h2 className="text-xl font-bold text-gray-600 mt-1">{eventTitle}</h2>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{eventDate}</p>
            <p className="text-sm text-gray-500">Gedruckt am: {new Date().toLocaleDateString('de-DE')}</p>
          </div>
        </div>

        {/* Content */}
        <div className="print-content">
          {children}
        </div>
        
      </div>
      
      {/* Hide standard UI in print mode, and hide this helper text during print */}
      <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-xl print:hidden">
        <p className="font-bold mb-2">Druckansicht</p>
        <p className="text-sm opacity-80 mb-4">Nutze Strg+P oder Cmd+P zum erneuten Drucken.</p>
        <button 
          onClick={() => window.close()} 
          className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded w-full"
        >
          Tab schließen
        </button>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
          }
          nav, header, footer, .navbar, .sidebar {
            display: none !important;
          }
          .page-break-after-avoid {
            page-break-after: avoid;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
