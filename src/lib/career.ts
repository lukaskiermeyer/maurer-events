import { BookingError } from './reservation-policy';
import type { CareerContent, CareerPosition } from '@/types/domain';

export const MAX_POSITIONS = 20;
export const MAX_BENEFITS = 10;

// Ausgangsinhalt; wird beim ersten Speichern durch die Admin-Eingaben ersetzt.
export const DEFAULT_CAREER_CONTENT: CareerContent = {
  headline: 'Werde Teil der Familie',
  intro: 'Maurer Events steht für unvergessliche Feste, ausgelassene Stimmung und echte bayerische Gastfreundschaft. Damit das so bleibt, suchen wir motivierte Leute, die anpacken können und Freude am Umgang mit Menschen haben!',
  positions: [
    {
      id: 'servicekraefte',
      title: 'Servicekräfte (m/w/d)',
      badge: 'Dringend gesucht',
      employment: 'Minijob / Teilzeit / Vollzeit',
      description: 'Du behältst auch bei einem vollen Zelt den Überblick, kannst mehrere Maßkrüge sicher zum Tisch manövrieren und hast immer ein Lächeln auf den Lippen? Dann bist du bei uns genau richtig!',
      benefits: ['Übertarifliche Bezahlung + Top Trinkgeld', 'Flexible Einsatzzeiten (Wochenende/Abends)', 'Tolles Team & Verpflegung inklusive'],
    },
    {
      id: 'zeltaufbau',
      title: 'Zeltaufbau & Logistik (m/w/d)',
      badge: '',
      employment: 'Minijob / Projektbasis',
      description: 'Du packst gerne mit an, bist handwerklich geschickt und hast kein Problem mit körperlicher Arbeit? Hilf uns dabei, aus einer leeren Wiese eine Party-Location zu zaubern!',
      benefits: ['Faire Entlohnung & Bonus bei schnellem Aufbau', 'Perfekt als Nebenjob für Studenten/Schüler', 'Starkes Teamgefühl'],
    },
  ],
  closingTitle: 'Nichts Passendes dabei?',
  closingText: 'Wir sind immer auf der Suche nach Talenten im Eventmanagement, Marketing oder Technik. Schick uns einfach eine Initiativbewerbung!',
};

const EMPTY_FALLBACK: CareerContent = {
  ...DEFAULT_CAREER_CONTENT,
  positions: [],
};

function readText(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== 'string') throw new BookingError(`Ungültige Angabe: ${field}.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new BookingError(`Bitte "${field}" ausfüllen.`);
  if (trimmed.length > max) throw new BookingError(`"${field}": maximal ${max} Zeichen.`);
  return trimmed;
}

function readBenefits(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BookingError(`Ungültige Angabe: ${field}.`);
  if (value.length > MAX_BENEFITS) throw new BookingError(`"${field}": maximal ${MAX_BENEFITS} Punkte.`);
  return value.map(entry => {
    if (typeof entry !== 'string') throw new BookingError(`Ungültige Angabe: ${field}.`);
    const trimmed = entry.trim();
    if (trimmed.length > 200) throw new BookingError(`"${field}": ein Punkt darf höchstens 200 Zeichen haben.`);
    return trimmed;
  }).filter(Boolean);
}

function readPosition(value: unknown): CareerPosition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookingError('Ungültige Stelle.');
  const entry = value as Record<string, unknown>;
  return {
    id: readText(entry.id, 'Kennung', 100),
    title: readText(entry.title, 'Stellenbezeichnung', 120),
    badge: readText(entry.badge, 'Hinweis', 60, false),
    employment: readText(entry.employment, 'Anstellungsart', 60, false),
    description: readText(entry.description, 'Beschreibung', 2000),
    benefits: readBenefits(entry.benefits, 'Vorteile'),
  };
}

export function validateCareerContent(input: unknown): CareerContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError('Ungültige Inhalte.');
  const data = input as Record<string, unknown>;
  if (!Array.isArray(data.positions)) throw new BookingError('Ungültige Stellenliste.');
  if (data.positions.length > MAX_POSITIONS) throw new BookingError(`Maximal ${MAX_POSITIONS} Stellen möglich.`);

  const positions = data.positions.map(readPosition);
  const ids = new Set<string>();
  for (const position of positions) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(position.id)) throw new BookingError('Ungültige Kennung einer Stelle.');
    if (ids.has(position.id)) throw new BookingError('Zwei Stellen haben dieselbe Kennung.');
    ids.add(position.id);
  }

  return {
    headline: readText(data.headline, 'Überschrift', 200),
    intro: readText(data.intro, 'Einleitungstext', 2000),
    positions,
    closingTitle: readText(data.closingTitle, 'Abschluss-Überschrift', 120, false),
    closingText: readText(data.closingText, 'Abschluss-Text', 1000, false),
  };
}

// Gespeicherte Inhalte werden nicht blind übernommen: Bei beschädigten oder
// veralteten Daten zeigt die Seite einen leeren Zustand statt eines Fehlers.
export function parseCareerContent(raw: string | undefined): CareerContent {
  if (!raw) return DEFAULT_CAREER_CONTENT;
  try {
    return validateCareerContent(JSON.parse(raw));
  } catch {
    return EMPTY_FALLBACK;
  }
}