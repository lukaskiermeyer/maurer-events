"use client";

// Zwei-Klick-Lösung für Google Maps: Der iframe wird erst nach ausdrücklicher
// Zustimmung des Nutzers geladen (TDDDG §25). Die Zustimmung wird im Browser
// gespeichert, damit nicht bei jedem Event neu gefragt werden muss.

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { parseCoordsFromText } from "@/lib/geo";
import { ui } from "@/lib/localize";

const MAPS_CONSENT_KEY = "me-maps-consent";

/**
 * Versucht, aus einem Google-Maps-Link eine Suchanfrage/Adresse zu extrahieren.
 * Unterstützt `?q=`, `?query=`, `/maps/search/...`, `/maps/place/...` und Koordinaten.
 * Kurze Links (maps.app.goo.gl) liefern nichts — dann fällt der Aufruf auf PLZ + Ort zurück.
 */
function extractMapsQuery(mapUrl: string): string | null {
  try {
    const url = new URL(mapUrl);
    const q = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("destination");
    if (q) return q.replace(/\+/g, " ").trim();
    const pathMatch = url.pathname.match(/\/maps\/(?:search|place)\/([^/@]+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]).replace(/\+/g, " ").trim();
    const coords = parseCoordsFromText(mapUrl);
    if (coords) return `${coords.lat},${coords.lng}`;
  } catch {
    // kein gültiger URL — Fallback greift
  }
  return null;
}

export default function EventMapEmbed({
  mapUrl,
  embedMapUrl,
  location,
  zip,
  title,
  locale,
}: {
  mapUrl?: string | null;
  embedMapUrl?: string | null;
  location: string;
  zip?: string | null;
  title: string;
  locale: string;
}) {
  const [consented, setConsented] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(MAPS_CONSENT_KEY) === "1") setConsented(true);
    } catch {
      // localStorage gesperrt — dann wird bei jedem Besuch gefragt
    }
    setMounted(true);
  }, []);

  const accept = () => {
    setConsented(true);
    try {
      window.localStorage.setItem(MAPS_CONSENT_KEY, "1");
    } catch {
      // ignore
    }
  };

  const revoke = () => {
    setConsented(false);
    try {
      window.localStorage.removeItem(MAPS_CONSENT_KEY);
    } catch {
      // ignore
    }
  };

  const fallbackQuery = [location, zip].filter(Boolean).join(" ");
  const openUrl =
    mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`;

  // Embed-Quelle: bevorzugt aus dem (aufgelösten) Maps-Link, sonst PLZ + Ort
  const embedQuery = (embedMapUrl ? extractMapsQuery(embedMapUrl) : null) || (mapUrl ? extractMapsQuery(mapUrl) : null) || fallbackQuery;
  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(embedQuery)}&output=embed&hl=${locale === "en" ? "en" : "de"}`;

  const text = {
    consent: ui(locale, {
      de: "Beim Laden der Karte werden Daten (u. a. Ihre IP-Adresse) an Google übertragen.",
      en: "Loading the map transfers data (including your IP address) to Google.",
      bar: "Beim Ladn der Karte werdn Daten (u. a. Eure IP-Adress) an Google übertrogn.",
    }),
    button: ui(locale, { de: "Karte laden", en: "Load map", bar: "Karte ladn" }),
    revoke: ui(locale, { de: "Zustimmung widerrufen", en: "Revoke map consent", bar: "Zustimmung widerrufn" }),
  };

  return (
    <div>
      <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-2">{ui(locale, { de: "Karte", en: "Map", bar: "Karte" })}</span>
      <div className="rounded-2xl overflow-hidden border border-border-light">
        {consented ? (
          <iframe
            key={embedSrc}
            src={embedSrc}
            width="100%"
            height="200"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Karte: ${title}`}
            allowFullScreen
          />
        ) : (
          <div className="h-[200px] bg-canvas-light flex flex-col items-center justify-center text-center px-6 gap-3">
            <svg className="w-8 h-8 text-accent-wood" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-xs text-base-dark/70 leading-relaxed">
              {text.consent}{" "}
              <Link href="/datenschutz" target="_blank" className="text-accent-green underline underline-offset-2 font-bold">
                {ui(locale, { de: "Datenschutzerklärung", en: "Privacy policy", bar: "Datenschutzerklärung" })}
              </Link>
            </p>
            <button
              type="button"
              onClick={accept}
              disabled={!mounted}
              className="bg-accent-green text-white px-5 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-accent-green/80 transition-colors disabled:opacity-50"
            >
              {text.button}
            </button>
          </div>
        )}
      </div>
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-accent-green hover:underline"
      >
        In Google Maps öffnen
      </a>
      {mounted && consented && (
        <button
          type="button"
          onClick={revoke}
          className="ml-3 text-xs text-base-dark/40 hover:text-base-dark/70 underline underline-offset-2"
        >
          {text.revoke}
        </button>
      )}
    </div>
  );
}
