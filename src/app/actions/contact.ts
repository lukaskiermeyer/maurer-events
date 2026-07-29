"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export async function submitContactForm(formData: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  turnstileToken: string;
}) {
  const { name, email, phone, message, turnstileToken } = formData;

  if (!turnstileToken) {
    return { success: false, error: "Spam-Schutz fehlgeschlagen. Bitte lade die Seite neu." };
  }

  // 1. Verify Turnstile Token
  if (TURNSTILE_SECRET_KEY) {
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
  } else {
    console.warn("TURNSTILE_SECRET_KEY is not set. Skipping real verification.");
  }

  // 2. Send Email via Resend
  if (!process.env.RESEND_API_KEY) {
     console.warn("RESEND_API_KEY is not set. Simulating success.");
     return { success: true };
  }

  try {
    const data = await resend.emails.send({
      from: "Website Kontaktformular <onboarding@resend.dev>", // Später durch z.B. info@maurer-events.de ersetzen, sobald Domain verifiziert ist
      to: ["info@maurer-events.de"],
      reply_to: email,
      subject: `Neue Anfrage von ${name}`,
      text: `Neue Kontaktanfrage über die Website:\n\nName: ${name}\nE-Mail: ${email}\nTelefon: ${phone || 'Nicht angegeben'}\n\nNachricht:\n${message}`,
    });

    if (data.error) {
      console.error("Resend API Error:", data.error);
      return { success: false, error: "E-Mail konnte nicht gesendet werden." };
    }

    return { success: true };
  } catch (error) {
    console.error("Email sending exception:", error);
    return { success: false, error: "Interner Fehler beim Senden der E-Mail." };
  }
}
