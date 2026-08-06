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
  const { name, email, eventType, message, turnstileToken } = formData;

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
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: "Spam-Schutz ist nicht konfiguriert." };
    }
    console.warn("TURNSTILE_SECRET_KEY is not set. Skipping real verification.");
  }

  // 2. Send Email via Resend
  if (!process.env.RESEND_API_KEY) {
     console.warn("RESEND_API_KEY is not set. Simulating success.");
     return { success: true };
  }

  try {
    const data = await resend.emails.send({
      from: "Maurer Events Kontakt <servus@maurer-events.com>",
      to: ["servus@maurer-events.com"],
      replyTo: email,
      subject: `Neue Anfrage von ${name} - ${eventType}`,
      text: `Neue Kontaktanfrage über die Website:\n\nName: ${name}\nE-Mail: ${email}\nVeranstaltungstyp: ${eventType}\n\nNachricht:\n${message}`,
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
