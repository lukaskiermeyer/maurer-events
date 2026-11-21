import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

// Zielsprachen der KI-Uebersetzung. "bar" = Bairisch/Boarisch (Dialekt).
export const TARGET_LANGS = ["en", "bar"] as const;
export type TargetLang = (typeof TARGET_LANGS)[number];

const LANGUAGE_LABEL: Record<TargetLang, string> = {
  en: "English",
  bar: "Bavarian (Boarisch), a German dialect",
};

const LANGUAGE_NOTE: Record<TargetLang, string> = {
  en: "",
  bar: " Write in authentic Upper-Bavarian dialect (Boarisch), e.g. 'mia', 'dei', 'Festl', 'griaß di', 'ois'. Keep it warm, colloquial and readable. Do not translate proper names, place names or brand names.",
};

export async function translateContent(text: string | null | undefined, targetLang: string = "en"): Promise<string | null> {
  if (!text) return null;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Skipping translation.");
    return text; // Fallback to original text if no key is set
  }

  const lang: TargetLang = (TARGET_LANGS as readonly string[]).includes(targetLang) ? (targetLang as TargetLang) : "en";

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using flash model for fast, cheap translations
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a professional translator for a Bavarian event and festival website.
Translate the following German text to ${LANGUAGE_LABEL[lang]}.${LANGUAGE_NOTE[lang]} Keep the tone festive, inviting, and professional.
Only return the translated text. Do not wrap it in quotes, markdown, or add any commentary.
Preserve all line breaks and empty lines exactly as in the original.

Original text:
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translated = response.text();

    // Remove potential markdown code blocks if the model ignored instructions
    if (translated.startsWith("```") && translated.endsWith("```")) {
      translated = translated.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
    }

    return translated;
  } catch (error) {
    console.error("Error during translation:", error);
    return text; // Fallback to original on error
  }
}

// Uebersetzt mehrere Felder einer Inhalts-Record in alle Zielsprachen auf einmal.
// Rueckgabe: { en: {feld: text}, bar: {feld: text} }. Leere Felder bleiben null.
// Ohne GEMINI_API_KEY liefert translateContent den Originaltext zurueck (Fallback),
// sodass Speichern auch ohne KI funktioniert und spaeter nachuebersetzt werden kann.
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  targets: readonly string[] = TARGET_LANGS,
): Promise<Record<string, Record<string, string | null>>> {
  const out: Record<string, Record<string, string | null>> = {};
  await Promise.all(
    targets.map(async (target) => {
      const entries = await Promise.all(
        Object.entries(fields).map(async ([key, value]) => [key, await translateContent(value, target)] as const),
      );
      out[target] = Object.fromEntries(entries);
    }),
  );
  return out;
}
