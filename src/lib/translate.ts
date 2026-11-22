// KI-Uebersetzung ueber NVIDIA NIM (OpenAI-kompatibler Chat-Completions-Endpunkt).
// Ohne NIM_API_KEY bleibt der Originaltext stehen (Fail-open), damit Speichern auch
// ohne KI funktioniert und spaeter nachuebersetzt werden kann. Konfiguration:
// NIM_API_KEY (noetig), NIM_BASE_URL und NIM_MODEL (optional, siehe .env.example).

const apiKey = process.env.NIM_API_KEY;
const baseUrl = (process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
// Reasoning-Modell: liefert zuverlaessig EN + Bairisch, braucht aber ein grosses
// Token-Budget (reasoning_content), sonst bleibt content leer. Bei leerem content
// wird fail-open auf den Originaltext zurueckgefallen.
const model = process.env.NIM_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";

// Zielsprachen der KI-Uebersetzung. "bar" = Bairisch/Boarisch (Dialekt).
export const TARGET_LANGS = ["en", "bar"] as const;
export type TargetLang = (typeof TARGET_LANGS)[number];

const LANGUAGE_LABEL: Record<TargetLang, string> = {
  en: "English",
  bar: "Bavarian (Boarisch), a German dialect",
};

// Sprachprofil fuer Bairisch: Westmittelbairisch (Donaubairisch mit Holledauer/
// Hallertauer Einschlag), Raum Neustadt an der Donau / Muenchsmuenster. Bewusst
// kein Oberpfaelzisch und kein Klischee-Bairisch; Orthografie nur mit Standard-
// Buchstaben (kein å/ã). Vorgabe des Kunden (Heimatdialekt), siehe messages/bar.json.
const LANGUAGE_NOTE: Record<TargetLang, string> = {
  en: "",
  bar: ` Schreibe in authentischem Westmittelbairisch (Donaubairisch mit Holledauer/Hallertauer Einschlag), wie im Raum Neustadt an der Donau und Münchsmünster (südlich der Donau) gesprochen.
Ton: modern, sympathisch, bodenständig und natürlich. Kein Klischee-Bairisch (kein „Ja mei“, „pfundig“, „Halli-Galli“) und kein Oberpfälzisch (keine gestürzten Diphthonge: richtig „Bruada“, „liab“, nicht „Brouder“, „leib“).
Schreibregeln (ausschließlich Standard-Buchstaben, keine Sonderzeichen wie å oder ã):
- L nach Vokal wird zu i: Holz→Hoiz, Geld→Geid, viel→vui, schnell→schnei.
- Helles a wird meist zu o: fahren→foahn, haben→hom, fragen→frogn (Ausnahme: machen→machan).
- Mittelhochdeutsches ei wird zu oa: heim→hoam, kein→koa, weiß→woaß, Stein→Stoa.
- Verkleinerungsform mit -al statt -chen: a bissal, a Packal, a Blatzal.
- Anrede: herzliches „Du“ (dei, di, dir) bzw. „Es/Eich“ für die Mehrzahl (ihr/euch), z. B. „Wia geht’s eich?“, „Mia gfrein uns“. Niemals das hochdeutsche „Sie“.
Referenz für UI-Begriffe: Startseite→Dahoam/Startseitn, Über uns→Üba uns/Wer mia san, Dienstleistungen→Unsa Orbat, Freunde→Freind (nicht Fraind), Kontakt→Kontakt/Schreib uns wos, Mehr erfahren→Mea erfoahn, Absenden→Oschicka, Abbrechen→Obbrecha, Schließen→Zuamacha, Suchen→Suacha, Willkommen→Servus und grias di auf unsara Seitn, Haben Sie Fragen?→Host a Frog?/Hobs es a Frog?, Vielen Dank→Vergelt’s Gott/Merci fia dei Nachricht, Es ist ein Fehler aufgetreten→Do is wos schiaf ganga.
Übersetze keine Eigennamen, Ortsnamen, Markennamen, technischen Bezeichner, URLs oder E-Mail-Adressen. Halte Buttons und Navigation kompakt, damit das Layout nicht bricht.`,
};

export async function translateContent(text: string | null | undefined, targetLang: string = "en"): Promise<string | null> {
  if (!text) return null;
  if (!apiKey) {
    console.warn("NIM_API_KEY is not set. Skipping translation.");
    return text; // Fallback to original text if no key is set
  }

  const lang: TargetLang = (TARGET_LANGS as readonly string[]).includes(targetLang) ? (targetLang as TargetLang) : "en";

  const prompt = `You are a professional translator for a Bavarian event and festival website.
Translate the following German text to ${LANGUAGE_LABEL[lang]}.${LANGUAGE_NOTE[lang]} Keep the tone festive, inviting, and professional.
Only return the translated text. Do not wrap it in quotes, markdown, or add any commentary.
Preserve all line breaks and empty lines exactly as in the original.
Preserve placeholders (e.g. {name}, {{count}}, %s), URLs, e-mail addresses and any HTML/Markdown tags exactly as in the original; never translate or alter them.

Original text:
${text}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 8192,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      console.error("NIM translation HTTP error:", res.status);
      return text; // Fallback to original on error
    }
    const data = await res.json();
    const translated: unknown = data?.choices?.[0]?.message?.content;
    // Reasoning-Modelle verbrauchen das Token-Budget teils vollstaendig fuer
    // reasoning_content und liefern content=null. Dann fail-open auf Original.
    if (typeof translated !== "string" || !translated.trim()) {
      console.warn("NIM returned no translation content; keeping original text.");
      return text;
    }
    const content = (translated as string).trim();

    // Remove potential markdown code blocks if the model ignored instructions
    let cleaned = content;
    if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
    }

    return cleaned;
  } catch (error) {
    console.error("Error during translation:", error);
    return text; // Fallback to original on error
  }
}

// Uebersetzt mehrere Felder einer Inhalts-Record in alle Zielsprachen auf einmal.
// Rueckgabe: { en: {feld: text}, bar: {feld: text} }. Leere Felder bleiben null.
// Ohne NIM_API_KEY liefert translateContent den Originaltext zurueck (Fallback),
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