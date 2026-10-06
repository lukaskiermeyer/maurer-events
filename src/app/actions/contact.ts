"use server";

import { Resend } from 'resend';
import { emailFrom } from '@/lib/email';
import { verifyTurnstile } from '@/lib/turnstile';
import { guestDetails } from '@/lib/reservation-policy';
import { takeRateLimit } from '@/lib/rate-limit';

export async function submitContactForm(formData: {
  name: string; email: string; eventType: string; message: string; turnstileToken: string;
}) {
  try {
    const { guestName: name, email } = guestDetails(formData?.name, formData?.email, 1);
    const eventType = formData?.eventType;
    const message = formData?.message;
    if (typeof eventType !== 'string' || !['volksfest', 'firma', 'verein', 'privat', 'sonstiges'].includes(eventType)) {
      return { success: false, error: 'Ungültige Veranstaltungsart.' };
    }
    if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
      return { success: false, error: 'Nachricht ist leer oder zu lang (maximal 2000 Zeichen).' };
    }
    await verifyTurnstile(formData?.turnstileToken, 'contact');
    if (!await takeRateLimit(`contact:${email}`, 5, 15 * 60000)) {
      return { success: false, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' };
    }
    if (!process.env.RESEND_API_KEY) return { success: false, error: 'E-Mail-Versand ist momentan nicht verfügbar.' };
    const recipient = process.env.CONTACT_EMAIL || 'servus@maurer-events.com';
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: emailFrom(), to: [recipient], replyTo: email,
      subject: `Neue Anfrage von ${name.replace(/[\r\n]/g, ' ')} - ${eventType}`,
      text: `Neue Kontaktanfrage\n\nName: ${name}\nE-Mail: ${email}\nVeranstaltungsart: ${eventType}\n\n${message.trim()}`,
    });
    if (result.error) return { success: false, error: 'E-Mail konnte nicht gesendet werden.' };
    return { success: true };
  } catch {
    return { success: false, error: 'Anfrage konnte nicht versendet werden. Bitte versuche es später erneut.' };
  }
}
