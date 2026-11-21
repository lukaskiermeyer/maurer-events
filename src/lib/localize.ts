// Zentrale Lokalisierung fuer alle admin-editierbaren Inhalte.
// Konvention: jedes Textfeld `x` hat Geschwister `xEn` und `xBar`.
// Aufloesung: Zielsprache -> Englisch -> Deutsch (Original).
export const LOCALE_SUFFIX: Record<string, string> = { en: "En", bar: "Bar" };

export function localized<T extends object>(row: T, field: string, locale: string): string {
  const record = row as Record<string, unknown>;
  const suffix = LOCALE_SUFFIX[locale];
  const direct = suffix ? record[field + suffix] : undefined;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (locale !== "de") {
    const en = record[field + "En"];
    if (typeof en === "string" && en.trim()) return en;
  }
  const base = record[field];
  return typeof base === "string" ? base : "";
}

// Fuer hartcodierte Entwickler-UI-Texte (keine Admin-Inhalte): drei Sprachen
// direkt an der Aufrufstelle, damit auch Bar abgedeckt ist. Bar faellt auf
// Englisch zurueck, falls kein Dialekt-Text gepflegt ist.
export function ui(locale: string, texts: { de: string; en: string; bar?: string }): string {
  if (locale === "bar") return texts.bar ?? texts.en;
  if (locale === "en") return texts.en;
  return texts.de;
}

// Datums-Format-Tags: Bairisch nutzt deutsches Format (keine eigene Intl-Locale).
export const DATE_TAG: Record<string, string> = { de: "de-DE", en: "en-GB", bar: "de-DE" };

export const MONTHS: Record<string, string[]> = {
  de: ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"],
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  bar: ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"],
};

// Fuer String-Arrays (z.B. Benefits): Zielsprache -> Englisch -> Deutsch.
export function localizedList<T extends object>(row: T, field: string, locale: string): string[] {
  const record = row as Record<string, unknown>;
  const suffix = LOCALE_SUFFIX[locale];
  const direct = suffix ? record[field + suffix] : undefined;
  if (Array.isArray(direct) && direct.length > 0) return direct as string[];
  if (locale !== "de") {
    const en = record[field + "En"];
    if (Array.isArray(en) && en.length > 0) return en as string[];
  }
  const base = record[field];
  return Array.isArray(base) ? (base as string[]) : [];
}
