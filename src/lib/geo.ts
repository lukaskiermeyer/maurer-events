export interface Coords {
  lat: number;
  lng: number;
}

const cache = new Map<string, Coords | null>();

let lastNominatim = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseCoordsFromText(text: string | null | undefined): Coords | null {
  if (!text) return null;
  const s = String(text);
  let m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.match(/ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.trim().match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // last resort: any two floats
  m = s.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

async function geocodePhoton(address: string): Promise<Coords | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data?.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lat: Number(coords[1]), lng: Number(coords[0]) };
    }
  } catch {
    // ignore
  }
  return null;
}

async function geocodeNominatim(address: string): Promise<Coords | null> {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatim));
  if (wait) await sleep(wait);
  lastNominatim = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { "User-Agent": "maurer-events/1.0 (servus@maurer-events.com)", Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function geocodeAddress(address: string | null | undefined): Promise<Coords | null> {
  const raw = (address || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const parsed = parseCoordsFromText(raw);
  if (parsed) {
    cache.set(key, parsed);
    return parsed;
  }

  let result = await geocodePhoton(raw);
  if (!result) result = await geocodeNominatim(raw);
  // retry with ", Deutschland" if no country
  if (!result && !/deutschland|germany/i.test(raw)) {
    result = await geocodePhoton(raw + ", Deutschland");
    if (!result) result = await geocodeNominatim(raw + ", Deutschland");
  }
  cache.set(key, result);
  return result;
}

export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}