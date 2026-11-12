import { Resend } from 'resend';
import { emailFrom } from '@/lib/email';
import { escapeHtml } from '@/lib/escape';

export interface ReservationRequestEmailData {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation: string;
  guestName: string;
  email: string;
  phone?: string | null;
  club?: string | null;
  guestCount: number;
  tables?: number | null;
  time?: string | null;
  message?: string | null;
  reservationEmail?: string | null;
}

export interface ReservationConfirmationEmailData extends ReservationRequestEmailData {
  tableName?: string | null;
  priceCents?: number | null;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPrice(cents?: number | null) {
  if (cents === null || cents === undefined) return null;
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="de">
<body style="margin:0;padding:0;background:#F4F0E8;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border:1px solid #E2DFD8;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#1F5732;padding:18px 28px;color:#FFFFFF;font-size:13px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;">Maurer Events</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#0A0A0A;">${title}</h1>
          ${body}
          <p style="margin:28px 0 0;font-size:12px;color:#6b6b6b;">Maurer Events · servus@maurer-events.com · maurer-events.com</p>
        </td></tr>
        <tr><td style="height:6px;background:#cb7913;"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRows(rows: Array<[string, string | null | undefined]>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-collapse:collapse;">${rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><td style="padding:7px 0;font-size:13px;color:#6b6b6b;width:42%;">${label}</td><td style="padding:7px 0;font-size:14px;font-weight:bold;color:#0A0A0A;">${escapeHtml(String(value))}</td></tr>`)
    .join('')}</table>`;
}

function requestBody(data: ReservationRequestEmailData) {
  return `
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Es ist eine neue Reservierungsanfrage eingegangen.</p>
    ${detailRows([
      ['Event', data.eventTitle],
      ['Datum', formatDate(data.eventDate)],
      ['Ort', data.eventLocation],
      ['Name', data.guestName],
      ['E-Mail', data.email],
      ['Telefon', data.phone],
      ['Verein/Firma', data.club],
      ['Personen', `${data.guestCount}`],
      ['Gewünschte Tische', data.tables ? `${data.tables}` : null],
      ['Uhrzeitwunsch', data.time],
      ['Nachricht', data.message],
    ])}
    <p style="margin:20px 0 0;"><a href="${escapeHtml(`${baseUrl()}/admin/events/${data.eventId}`)}" style="display:inline-block;background:#1F5732;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:bold;">Im Admin öffnen</a></p>`;
}

function confirmationBody(data: ReservationConfirmationEmailData) {
  const price = formatPrice(data.priceCents);
  return `
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Servus ${escapeHtml(data.guestName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">deine Reservierung für <b>${escapeHtml(data.eventTitle)}</b> ist bestätigt.</p>
    ${detailRows([
      ['Datum', formatDate(data.eventDate)],
      ['Ort', data.eventLocation],
      ['Tisch', data.tableName || 'wird vor Ort zugewiesen'],
      ['Personen', `${data.guestCount}`],
      ['Uhrzeit', data.time],
      ['Preis', price],
      ['Verein/Firma', data.club],
    ])}
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;">Bei Fragen einfach auf diese E-Mail antworten.</p>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;">Servus und bis bald!<br/>Maurer Events</p>`;
}

function declineBody(data: ReservationRequestEmailData, reason?: string | null) {
  return `
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Servus ${escapeHtml(data.guestName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">leider können wir deine Anfrage für <b>${escapeHtml(data.eventTitle)}</b> am ${formatDate(data.eventDate)} nicht bestätigen.</p>
    ${reason ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;">${escapeHtml(reason)}</p>` : ''}
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;">Melde dich gerne bei uns, wenn du eine andere Lösung brauchst.</p>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;">Servus!<br/>Maurer Events</p>`;
}

async function send(payload: Parameters<Resend['emails']['send']>[0], idempotencyKey: string) {
  if (!process.env.RESEND_API_KEY) return 'E-Mail-Versand ist nicht konfiguriert.';
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, { idempotencyKey });
    return result.error ? 'E-Mail konnte nicht gesendet werden.' : undefined;
  } catch {
    return 'E-Mail konnte nicht gesendet werden.';
  }
}

export async function sendReservationRequestEmails(data: ReservationRequestEmailData) {
  const adminTo = data.reservationEmail || process.env.CONTACT_EMAIL || 'servus@maurer-events.com';
  const warnings: string[] = [];
  const adminWarning = await send({
    from: emailFrom(),
    to: [adminTo],
    replyTo: data.email,
    subject: `Neue Reservierungsanfrage: ${data.eventTitle} (${formatDate(data.eventDate)})`,
    html: layout('Neue Reservierungsanfrage', requestBody(data)),
    text: `Neue Reservierungsanfrage\n\nEvent: ${data.eventTitle}\nDatum: ${formatDate(data.eventDate)}\nName: ${data.guestName}\nE-Mail: ${data.email}\nPersonen: ${data.guestCount}\nTische: ${data.tables || 1}\nNachricht: ${data.message || ''}`,
  }, `reservation-request:${data.id}:admin`);
  if (adminWarning) warnings.push(adminWarning);

  const guestWarning = await send({
    from: emailFrom(),
    to: [data.email],
    replyTo: adminTo,
    subject: `Deine Reservierungsanfrage für ${data.eventTitle}`,
    html: layout('Anfrage eingegangen', `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Servus ${escapeHtml(data.guestName)},</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">deine Anfrage für <b>${escapeHtml(data.eventTitle)}</b> am ${formatDate(data.eventDate)} ist bei uns eingegangen. Wir melden uns in der Regel innerhalb von 2 Werktagen.</p>
      ${detailRows([['Personen', `${data.guestCount}`], ['Gewünschte Tische', data.tables ? `${data.tables}` : null], ['Uhrzeitwunsch', data.time]])}
      <p style="margin:18px 0 0;font-size:15px;line-height:1.6;">Servus!<br/>Maurer Events</p>`),
    text: `Servus ${data.guestName},\n\ndeine Anfrage für ${data.eventTitle} am ${formatDate(data.eventDate)} ist eingegangen. Wir melden uns in der Regel innerhalb von 2 Werktagen.\n\nMaurer Events`,
  }, `reservation-request:${data.id}:guest`);
  if (guestWarning) warnings.push(guestWarning);

  return warnings.length ? warnings.join(' ') : undefined;
}

export async function sendReservationConfirmation(data: ReservationConfirmationEmailData) {
  return send({
    from: emailFrom(),
    to: [data.email],
    replyTo: data.reservationEmail || process.env.CONTACT_EMAIL || 'servus@maurer-events.com',
    subject: `Reservierung bestätigt: ${data.eventTitle}`,
    html: layout('Reservierung bestätigt', confirmationBody(data)),
    text: `Servus ${data.guestName},\n\ndeine Reservierung für ${data.eventTitle} am ${formatDate(data.eventDate)} ist bestätigt.\nTisch: ${data.tableName || 'wird vor Ort zugewiesen'}\nPersonen: ${data.guestCount}\n\nMaurer Events`,
  }, `reservation-confirm:${data.id}`);
}

export async function sendReservationDecline(data: ReservationRequestEmailData, reason?: string | null) {
  return send({
    from: emailFrom(),
    to: [data.email],
    replyTo: data.reservationEmail || process.env.CONTACT_EMAIL || 'servus@maurer-events.com',
    subject: `Deine Reservierungsanfrage für ${data.eventTitle}`,
    html: layout('Reservierungsanfrage', declineBody(data, reason)),
    text: `Servus ${data.guestName},\n\nleider können wir deine Anfrage für ${data.eventTitle} am ${formatDate(data.eventDate)} nicht bestätigen.\n${reason || ''}\n\nMaurer Events`,
  }, `reservation-decline:${data.id}`);
}