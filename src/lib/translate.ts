import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function translateContent(text: string | null | undefined, targetLang: string = "en"): Promise<string | null> {
  if (!text) return null;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Skipping translation.");
    return text; // Fallback to original text if no key is set
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using flash model for fast, cheap translations
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a professional translator for a Bavarian event and festival website.
Translate the following German text to English. Keep the tone festive, inviting, and professional.
Only return the translated text. Do not wrap it in quotes, markdown, or add any commentary.

Original text:
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translated = response.text().trim();
    
    // Remove potential markdown code blocks if the model ignored instructions
    if (translated.startsWith("\`\`\`") && translated.endsWith("\`\`\`")) {
      translated = translated.replace(/^\`\`\`[a-z]*\n/, "").replace(/\n\`\`\`$/, "");
    }
    
    return translated;
  } catch (error) {
    console.error("Error during translation:", error);
    return text; // Fallback to original on error
  }
}
