import { BookingError } from './reservation-policy';
import type { CareerContent, CareerPosition } from '@/types/domain';
import { localized, localizedList } from './localize';
import { translateFields } from './translate';

export const MAX_POSITIONS = 20;
export const MAX_BENEFITS = 10;

// Ausgangsinhalt; wird beim ersten Speichern durch die Admin-Eingaben ersetzt.
export const DEFAULT_CAREER_CONTENT: CareerContent = {
  headline: 'Werde Teil der Familie',
  headlineEn: 'Become part of the family',
  intro: 'Ob für die Zubereitung unserer Schmankerl, im Ausschank oder hinter den Kulissen: Für reibungslose Abläufe braucht es ein Team, das Zusammenhalt schätzt und sich gegenseitig unterstützt.',
  introEn: 'Whether preparing our delicacies, serving drinks, or behind the scenes: smooth operations need a team that values cohesion and supports each other.',
  positions: [
    {
      id: 'servicekraefte',
      title: 'Servicekräfte (m/w/d)',
      titleEn: 'Service staff (m/f/d)',
      badge: 'Dringend gesucht',
      badgeEn: 'Urgently wanted',
      employment: 'Minijob / Teilzeit / Vollzeit',
      employmentEn: 'Minijob / Part-time / Full-time',
      description: 'Du behältst auch bei einem vollen Zelt den Überblick, kannst mehrere Maßkrüge sicher zum Tisch manövrieren und hast immer ein Lächeln auf den Lippen? Dann bist du bei uns genau richtig!',
      descriptionEn: 'You keep your cool in a packed tent, can safely carry several beer mugs to the table and always have a smile on your face? Then you are exactly where you need to be!',
      benefits: ['Übertarifliche Bezahlung + Top Trinkgeld', 'Flexible Einsatzzeiten (Wochenende/Abends)', 'Tolles Team & Verpflegung inklusive'],
      benefitsEn: ['Above-tariff pay + great tips', 'Flexible shifts (weekends/evenings)', 'Great team & meals included'],
    },
    {
      id: 'zeltaufbau',
      title: 'Zeltaufbau & Logistik (m/w/d)',
      titleEn: 'Tent setup & logistics (m/f/d)',
      badge: '',
      badgeEn: '',
      employment: 'Minijob / Projektbasis',
      employmentEn: 'Minijob / Project-based',
      description: 'Du packst gerne mit an, bist handwerklich geschickt und hast kein Problem mit körperlicher Arbeit? Hilf uns dabei, aus einer leeren Wiese eine Party-Location zu zaubern!',
      descriptionEn: 'You like to pitch in, are handy and do not mind physical work? Help us turn an empty meadow into a party location!',
      benefits: ['Faire Entlohnung & Bonus bei schnellem Aufbau', 'Perfekt als Nebenjob für Studenten/Schüler', 'Starkes Teamgefühl'],
      benefitsEn: ['Fair pay & bonus for fast setup', 'Perfect side job for students', 'Strong team spirit'],
    },
  ],
  closingTitle: 'Nichts Passendes dabei?',
  closingTitleEn: 'Nothing suitable for you?',
  closingText: 'Wir sind immer auf der Suche nach Talenten im Eventmanagement, Marketing oder Technik. Schick uns einfach eine Initiativbewerbung!',
  closingTextEn: 'We are always looking for talent in event management, marketing or tech. Just send us a speculative application!',
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

function readOptionalText(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return '';
  return readText(value, field, max, false);
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
    titleEn: readOptionalText(entry.titleEn, 'Stellenbezeichnung (Englisch)', 120),
    titleBar: readOptionalText(entry.titleBar, 'Stellenbezeichnung (Bairisch)', 120),
    badge: readText(entry.badge, 'Hinweis', 60, false),
    badgeEn: readOptionalText(entry.badgeEn, 'Hinweis (Englisch)', 60),
    badgeBar: readOptionalText(entry.badgeBar, 'Hinweis (Bairisch)', 60),
    employment: readText(entry.employment, 'Anstellungsart', 60, false),
    employmentEn: readOptionalText(entry.employmentEn, 'Anstellungsart (Englisch)', 60),
    employmentBar: readOptionalText(entry.employmentBar, 'Anstellungsart (Bairisch)', 60),
    description: readText(entry.description, 'Beschreibung', 2000),
    descriptionEn: readOptionalText(entry.descriptionEn, 'Beschreibung (Englisch)', 2000),
    descriptionBar: readOptionalText(entry.descriptionBar, 'Beschreibung (Bairisch)', 2000),
    benefits: readBenefits(entry.benefits, 'Vorteile'),
    benefitsEn: readBenefits(entry.benefitsEn, 'Vorteile (Englisch)'),
    benefitsBar: readBenefits(entry.benefitsBar, 'Vorteile (Bairisch)'),
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
    headlineEn: readOptionalText(data.headlineEn, 'Überschrift (Englisch)', 200),
    headlineBar: readOptionalText(data.headlineBar, 'Überschrift (Bairisch)', 200),
    intro: readText(data.intro, 'Einleitungstext', 2000),
    introEn: readOptionalText(data.introEn, 'Einleitungstext (Englisch)', 2000),
    introBar: readOptionalText(data.introBar, 'Einleitungstext (Bairisch)', 2000),
    positions,
    closingTitle: readText(data.closingTitle, 'Abschluss-Überschrift', 120, false),
    closingTitleEn: readOptionalText(data.closingTitleEn, 'Abschluss-Überschrift (Englisch)', 120),
    closingTitleBar: readOptionalText(data.closingTitleBar, 'Abschluss-Überschrift (Bairisch)', 120),
    closingText: readText(data.closingText, 'Abschluss-Text', 1000, false),
    closingTextEn: readOptionalText(data.closingTextEn, 'Abschluss-Text (Englisch)', 1000),
    closingTextBar: readOptionalText(data.closingTextBar, 'Abschluss-Text (Bairisch)', 1000),
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

// Zielsprache anzeigen, wenn vorhanden — sonst Englisch, sonst Deutsch.
// Deckt EN und Bar ueber die zentrale Lokalisierung ab.
export function localizeCareerContent(content: CareerContent, locale: string): CareerContent {
  if (locale === 'de') return content;
  return {
    ...content,
    headline: localized(content, 'headline', locale),
    intro: localized(content, 'intro', locale),
    closingTitle: localized(content, 'closingTitle', locale),
    closingText: localized(content, 'closingText', locale),
    positions: content.positions.map((position) => ({
      ...position,
      title: localized(position, 'title', locale),
      badge: localized(position, 'badge', locale),
      employment: localized(position, 'employment', locale),
      description: localized(position, 'description', locale),
      benefits: localizedList(position, 'benefits', locale),
    })),
  };
}

// Fuellt leere EN/Bar-Felder per KI (einmal eingeben, dann nur drüberlesen).
// Ohne GEMINI_API_KEY bleibt der Originaltext stehen (Fallback), manuell editierbar.
export async function fillCareerTranslations(content: CareerContent): Promise<CareerContent> {
  const scalar = await translateFields({
    headline: content.headline,
    intro: content.intro,
    closingTitle: content.closingTitle,
    closingText: content.closingText,
  });
  const fill = (current: string | undefined, translated: string | null) =>
    current && current.trim() ? current : (translated ?? undefined);

  const positions = await Promise.all(content.positions.map(async (position) => {
    const t = await translateFields({
      title: position.title,
      badge: position.badge,
      employment: position.employment,
      description: position.description,
    });
    return {
      ...position,
      titleEn: fill(position.titleEn, t.en.title),
      titleBar: fill(position.titleBar, t.bar.title),
      badgeEn: fill(position.badgeEn, t.en.badge),
      badgeBar: fill(position.badgeBar, t.bar.badge),
      employmentEn: fill(position.employmentEn, t.en.employment),
      employmentBar: fill(position.employmentBar, t.bar.employment),
      descriptionEn: fill(position.descriptionEn, t.en.description),
      descriptionBar: fill(position.descriptionBar, t.bar.description),
    };
  }));

  return {
    ...content,
    headlineEn: fill(content.headlineEn, scalar.en.headline),
    headlineBar: fill(content.headlineBar, scalar.bar.headline),
    introEn: fill(content.introEn, scalar.en.intro),
    introBar: fill(content.introBar, scalar.bar.intro),
    closingTitleEn: fill(content.closingTitleEn, scalar.en.closingTitle),
    closingTitleBar: fill(content.closingTitleBar, scalar.bar.closingTitle),
    closingTextEn: fill(content.closingTextEn, scalar.en.closingText),
    closingTextBar: fill(content.closingTextBar, scalar.bar.closingText),
    positions,
  };
}