// Local PDF fixtures only: no database, provider calls or emails.
import { mkdir, writeFile } from 'node:fs/promises';
import { generateTicketPdf } from '../src/lib/ticket';

async function main() {
  await mkdir('test-results', { recursive: true });
  const common = { date: '13.10.2026', time: '18:00', location: 'Festzelt Müchsmünster', guestCount: 8, qrCodeText: '12345678-1234-4234-8234-123456789abc' };
  const fixtures = [
    { name: 'normal', eventName: 'Herbstfest bei Maurer Events', guestName: 'Anna Müller', tableName: 'Tisch 8' },
    { name: 'long', eventName: 'Herbstfest mit Musik, Brotzeit und Freunden in München '.repeat(6).slice(0, 300), guestName: 'Alexandra Müller-Lüdenscheidt von Hohenlohe und Schillingsfürst '.repeat(2).slice(0, 100), tableName: 'Festzelt-Tisch im überdachten Außenbereich neben der Bühne '.repeat(2).slice(0, 100) },
  ];
  for (const { name, ...details } of fixtures) {
    const pdf = await generateTicketPdf({ ...common, ...details });
    if (!pdf) throw new Error(`PDF generation failed: ${name}`);
    await writeFile(`test-results/ticket-layout-${name}.pdf`, pdf);
  }
  await writeFile('test-results/ticket-layout-fixtures.json', JSON.stringify(fixtures, null, 2));
  const preview = await generateTicketPdf({ ...common, eventName: 'Herbstfest bei Maurer Events', guestName: 'Anna Müller', tableName: 'Tisch 8' });
  if (!preview) throw new Error('Ticket preview failed');
  await mkdir('output/pdf', { recursive: true });
  await writeFile('output/pdf/ticket-vorschau.pdf', preview);
  console.log('Generated normal and maximum-length ticket fixtures locally.');
}
main().catch(() => { console.error('Ticket layout check failed.'); process.exitCode = 1; });
