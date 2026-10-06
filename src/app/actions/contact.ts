"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export async function submitContactForm(formData: {
  name: string;
  email: string;
  eventType: string;
  message: string;
  turnstileToken: string;
}) {
  // TODO: Cloudflare Rate Limit Rule für Kontaktformular (z.B. 5 req/min pro IP)
  
  let { name, email, eventType, message, turnstileToken } = formData;

  // 1. Serverseitige Validierung
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return { success: false, error: "Ungültiger Name (max 100 Zeichen)." };
  }
  
  if (!email || typeof email !== 'string' || email.length > 255 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return { success: false, error: "Ungültige E-Mail-Adresse." };
  }

  if (!eventType || typeof eventType !== 'string' || eventType.length > 100) {
    return { success: false, error: "Ungültiger Veranstaltungstyp (max 100 Zeichen)." };
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) {
    return { success: false, error: "Nachricht ist zu lang oder leer (max 2000 Zeichen)." };
  }

  // Header-Injection verhindern
  const cleanHeader = (str: string) => str.replace(/[\r\n]/g, ' ').trim();
  const safeName = cleanHeader(name);
  const safeEmail = cleanHeader(email.toLowerCase());
  const safeEventType = cleanHeader(eventType);
  const safeMessage = message.trim();

  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return { success: false, error: "Spam-Schutz fehlgeschlagen. Bitte lade die Seite neu." };
  }

  // 2. Verify Turnstile Token (Fail-Closed)
  if (!TURNSTILE_SECRET_KEY) {
    console.error("TURNSTILE_SECRET_KEY is not configured.");
    return { success: false, error: "Spam-Schutz ist aktuell nicht konfiguriert (Fehler 503)." };
  }

  const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const verifyData = new URLSearchParams();
  verifyData.append('secret', TURNSTILE_SECRET_KEY);
  verifyData.append('response', turnstileToken);

  try {
    const turnstileResponse = await fetch(verifyUrl, {
      method: 'POST',
      body: verifyData,
    });
    const turnstileOutcome = await turnstileResponse.json();
    if (!turnstileOutcome.success) {
      return { success: false, error: "Spam-Schutz fehlgeschlagen (Cloudflare Check negativ)." };
    }
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { success: false, error: "Verbindungsfehler beim Spam-Schutz." };
  }

  // 3. Send Email via Resend
  if (!process.env.RESEND_API_KEY) {
     console.warn("RESEND_API_KEY is not set. Simulating success.");
     return { success: true };
  }

  try {
    const data = await resend.emails.send({
      from: "Maurer Events Kontakt <servus@maurer-events.com>",
      to: ["servus@maurer-events.com"],
      replyTo: safeEmail,
      subject: `Neue Anfrage von ${safeName} - ${safeEventType}`,
      text: `Neue Kontaktanfrage über die Website:\n\nName: ${safeName}\nE-Mail: ${safeEmail}\nVeranstaltungstyp: ${safeEventType}\n\nNachricht:\n${safeMessage}`,
    });

    if (data.error) {
      console.error("Resend API Error:", data.error.message);
      return { success: false, error: "E-Mail konnte nicht gesendet werden." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Email sending exception:", error.message);
    return { success: false, error: "Interner Fehler beim Senden der E-Mail." };
  }
}
