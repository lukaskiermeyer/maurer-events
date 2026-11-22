"use server";

import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { Resend } from 'resend';

import { requireAdmin } from '@/lib/auth';
import { parseCareerContent, validateCareerContent, fillCareerTranslations } from '@/lib/career';
import { emailFrom } from '@/lib/email';
import { renderEmail } from '@/lib/email-template';
import { escapeHtml } from '@/lib/escape';
import { lockLayout } from '@/lib/reservation-db';
import { BookingError, guestDetails } from '@/lib/reservation-policy';
import { takeRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import type { CareerContent } from '@/types/domain';

const CAREER_KEY = 'career_content';

const ATTACHMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export async function getCareerContent(): Promise<CareerContent> {
  const [row] = await db.select().from(settings).where(eq(settings.key, CAREER_KEY));
  return parseCareerContent(row?.value);
}

export async function updateCareerContent(input: unknown) {
  await requireAdmin();
  const content = validateCareerContent(input);
  const value = JSON.stringify(content);
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    await tx.insert(settings).values({ key: CAREER_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
  revalidatePath('/[locale]/karriere', 'page');
  revalidatePath('/[locale]', 'layout');
  // KI-Uebersetzung nicht blockierend: leere EN/Bar-Felder nach der Antwort fuellen.
  after(async () => {
    try {
      const [row] = await db.select().from(settings).where(eq(settings.key, CAREER_KEY));
      const current = parseCareerContent(row?.value);
      const filled = await fillCareerTranslations(current);
      if (JSON.stringify(filled) !== JSON.stringify(current)) {
        await db.update(settings).set({ value: JSON.stringify(filled) }).where(eq(settings.key, CAREER_KEY));
        revalidatePath('/[locale]/karriere', 'page');
        revalidatePath('/[locale]', 'layout');
      }
    } catch (e) { console.error('Career background translation failed:', e); }
  });
  return content;
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export async function submitApplication(form: {
  name: string; email: string; phone?: string; position?: string; message: string;
  attachmentName?: string; attachmentType?: string; attachmentBase64?: string;
  turnstileToken: string;
}) {
  try {
    const { guestName: name, email } = guestDetails(form?.name, form?.email, 1);

    const message = typeof form?.message === 'string' ? form.message.trim() : '';
    if (!message) return { success: false, error: 'Bitte eine kurze Nachricht schreiben.' };
    if (message.length > 2000) return { success: false, error: 'Die Nachricht darf höchstens 2000 Zeichen haben.' };

    const phone = typeof form?.phone === 'string' ? singleLine(form.phone) : '';
    if (phone.length > 40) return { success: false, error: 'Bitte eine gültige Telefonnummer angeben.' };

    const position = typeof form?.position === 'string' ? singleLine(form.position) : '';
    if (position.length > 120) return { success: false, error: 'Ungültige Stellenauswahl.' };

    let attachments: { filename: string; content: Buffer }[] | undefined;
    if (form?.attachmentBase64) {
      const type = form.attachmentType;
      if (typeof type !== 'string' || !Object.hasOwn(ATTACHMENT_TYPES, type)) {
        return { success: false, error: 'Bitte Lebenslauf als PDF, JPG, PNG oder Word-Datei anhängen.' };
      }
      if (typeof form.attachmentBase64 !== 'string' || !form.attachmentBase64.length) {
        return { success: false, error: 'Der Anhang konnte nicht gelesen werden.' };
      }
      const bytes = Buffer.from(form.attachmentBase64, 'base64');
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        return { success: false, error: 'Der Anhang darf höchstens 2 MB groß sein.' };
      }
      const base = (form.attachmentName || 'lebenslauf').replace(/[^\w.-]+/g, '_').replace(/\.[^.]+$/, '').slice(0, 60) || 'lebenslauf';
      attachments = [{ filename: `${base}.${ATTACHMENT_TYPES[type]}`, content: bytes }];
    }

    await verifyTurnstile(form?.turnstileToken, 'application');

    if (!await takeRateLimit(`application:${email}`, 3, 60 * 60000)) {
      return { success: false, error: 'Zu viele Bewerbungen von dieser Adresse. Bitte später erneut versuchen.' };
    }

    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: 'E-Mail-Versand ist momentan nicht verfügbar.' };
    }

    const recipient = process.env.CONTACT_EMAIL || 'servus@maurer-events.com';
    const lines = [
      'Neue Bewerbung über die Website',
      '',
      `Name: ${name}`,
      `E-Mail: ${email}`,
      phone ? `Telefon: ${phone}` : null,
      `Stelle: ${position || 'Initiativbewerbung'}`,
      attachments?.[0] ? `Anhang: ${attachments[0].filename}` : 'Anhang: keiner',
      '',
      message,
    ].filter((line): line is string => line !== null);

    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: emailFrom(),
      to: [recipient],
      replyTo: email,
      subject: `Bewerbung: ${position || 'Initiativbewerbung'} – ${name}`,
      text: lines.join('\n'),
      html: renderEmail({
        title: 'Neue Bewerbung',
        preheader: `${name} – ${position || 'Initiativbewerbung'}`,
        blocks: [
          { type: 'paragraph', text: `Name: ${escapeHtml(name)}` },
          { type: 'paragraph', text: `E-Mail: ${escapeHtml(email)}` },
          ...(phone ? [{ type: 'paragraph' as const, text: `Telefon: ${escapeHtml(phone)}` }] : []),
          { type: 'paragraph', text: `Stelle: ${escapeHtml(position || 'Initiativbewerbung')}` },
          { type: 'paragraph', text: attachments?.[0] ? `Anhang: ${escapeHtml(attachments[0].filename)}` : 'Anhang: keiner' },
          { type: 'divider' },
          { type: 'paragraph', text: escapeHtml(message).replace(/\n/g, '<br/>') },
        ],
        footerNote: 'Maurer Events · Karriere',
      }),
      attachments,
    });

    if (result.error) return { success: false, error: 'Bewerbung konnte nicht gesendet werden.' };
    return { success: true };
  } catch (error) {
    // Serverfehler nicht nach außen spiegeln; nur fachliche Hinweise sind nutzersicher.
    if (error instanceof BookingError && error.status < 500) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Bewerbung konnte nicht versendet werden. Bitte versuche es später erneut.' };
  }
}