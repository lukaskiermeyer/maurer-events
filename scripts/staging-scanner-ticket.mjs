// Extract the already-sent test ticket for local decoder checks. No check-in or mail.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';

const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const [row] = await db`SELECT qr_code_text,ticket_email_payload,status::text,scanned_at FROM public.reservations
    WHERE id='e74b155b-298a-4c23-8294-7844f22e3856' AND event_id='ff10cb2c-5eb8-4d82-92bd-d0066b741743'
    AND lower(trim(email))='hello@madebylui.net'`;
  const attachment = row?.ticket_email_payload?.attachments?.find(item => item.filename === 'ticket.pdf');
  if (!row?.qr_code_text || !attachment?.content) throw new Error('Issued test ticket not found');
  await fs.writeFile('test-results/scanner-issued-ticket.pdf', Buffer.from(attachment.content, 'base64'));
  await fs.writeFile('test-results/scanner-ticket-private.json', JSON.stringify({ expectedQr: row.qr_code_text }));
  console.log(JSON.stringify({ extractedAlreadySentTicket: true, status: row.status, alreadyScanned: !!row.scanned_at, checkInPerformed: false }));
} finally { await db.end({ timeout: 3 }); }
