"use client";

import { useState } from "react";
import { Scanner, prepareZXingModule, type IScannerError } from "@yudiel/react-qr-scanner";

// Configure the library before its first detection attempt. Its default CDN is
// deliberately outside our connect-src policy, and must not be needed at the door.
function configureDecoder() {
  prepareZXingModule({
    overrides: {
      locateFile: (path, prefix) => path.endsWith(".wasm") ? "/scanner/zxing_reader.wasm" : prefix + path,
    },
    // Also discard a rejected initialization promise on an explicit retry.
    equalityFn: () => false,
  });
}
configureDecoder();

const cameraConstraints: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

function errorMessage(error: IScannerError): string {
  switch (error.kind) {
    case "permission-denied": return "Bitte erlaube den Kamerazugriff in deinem Browser.";
    case "no-camera": return "Keine Kamera gefunden. Bitte verwende ein Gerät mit Kamera.";
    case "in-use": return "Die Kamera wird bereits verwendet. Bitte schließe andere Kamera-Anwendungen.";
    default: return "QR-Erkennung konnte nicht gestartet werden. Bitte starte den Scanner erneut.";
  }
}

export default function TicketQrScanner({ onScan, paused = false }: { onScan: (value: string) => void; paused?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="relative w-full h-full">
      <Scanner
        key={attempt}
        formats={["qr_code"]}
        constraints={cameraConstraints}
        paused={paused || !!error}
        allowMultiple
        scanDelay={1000}
        onScan={codes => { if (codes[0]?.rawValue) onScan(codes[0].rawValue); }}
        onError={failure => setError(errorMessage(failure))}
      />
      {error && (
        <div role="alert" className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-6 text-center text-white">
          <p className="font-bold">{error}</p>
          <button type="button" className="mt-6 px-5 py-3 rounded-xl bg-accent-green font-bold" onClick={() => { configureDecoder(); setError(null); setAttempt(value => value + 1); }}>
            Scanner neu starten
          </button>
        </div>
      )}
    </div>
  );
}
