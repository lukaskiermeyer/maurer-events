// Manual acceptance on the authorized test database and a local production build.
// Own temporary sessions, grants and events only; no OTP, mail, payment or real QR.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import postgres from 'postgres';
import { chromium, expect } from '@playwright/test';

if (!process.argv.includes('--confirmed-test-database')) throw new Error('Explicit test-database confirmation required');
const origin = 'http://localhost:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
const owner = process.env.ADMIN_EMAILS?.split(',').map(value => value.trim().toLowerCase()).find(Boolean);
if (!owner) throw new Error('An existing Admin allowlist is required');
const helper = `scanner-${randomUUID()}@example.com`;
const adminToken = randomUUID(), helperToken = randomUUID();
const eventId = randomUUID(), otherEventId = randomUUID();
const bookings = Array.from({ length: 4 }, () => ({ id: randomUUID(), qr: randomUUID() }));
const manifest = JSON.parse(await fs.readFile('.next/server/server-reference-manifest.json', 'utf8'));
const actions = Object.fromEntries(Object.entries(manifest.node).map(([id, value]) => [value.exportedName, id]));
const results = [];
await fs.mkdir('test-results/admin-role-browser', { recursive: true });
let browser;

async function invoke(token, name, args = []) {
  if (!actions[name]) throw new Error(`Missing action: ${name}`);
  // Call the route that owns this action in the production manifest.
  const route = name === 'scanTicket' ? '/admin/scan' : name === 'getReservations' ? '/admin' : `/admin/events/${eventId}`;
  const response = await fetch(`${origin}${route}`, {
    method: 'POST', headers: { 'Next-Action': actions[name], Origin: origin, 'Content-Type': 'text/plain;charset=UTF-8', Cookie: `admin_token=${token}` },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  return { status: response.status, body, contentType: response.headers.get('content-type'), urlPath: new URL(response.url).pathname, redirect: response.headers.get('x-action-redirect') };
}
function rejected(response) { return (/:E\{/.test(response.body) || (response.status === 404 && /Server action not found/i.test(response.body))) && !response.body.includes('Browser Gast') && !response.body.includes('"success":true'); }
function returned(response, success) { return response.status === 200 && response.body.includes(`"success":${success}`); }
async function noOverflow(page, scenario) {
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.right > innerWidth + 2 && getComputedStyle(node).position !== 'fixed';
  }).slice(0, 8).map(node => ({ tag: node.tagName, class: node.className.toString().slice(0, 130) })) }));
  if (layout.content > layout.width + 2) throw new Error(`${scenario}: horizontal overflow ${JSON.stringify(layout)}`);
}
async function staffContext(token, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await context.addCookies([{ name: 'admin_token', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  return context;
}

try {
  await sql.begin(async tx => {
    for (const id of [eventId, otherEventId]) await tx`INSERT INTO public.events (id,title,date,location,description,reservable,allow_table_selection,max_capacity,reservable_dates) VALUES (${id},'Mobile Admin Test', '2026-10-13 00:00:00', 'Testzelt', 'Temporary browser acceptance fixture', true, false, 100, '["2026-10-13"]')`;
    for (const [index, booking] of bookings.entries()) await tx`INSERT INTO public.reservations (id,event_id,reservation_date,guest_name,email,guest_count,selected_time,amount_total,status,qr_code_text) VALUES (${booking.id},${index === 3 ? otherEventId : eventId},'2026-10-13 00:00:00',${`Browser Gast ${index + 1}`},'guest@example.com',1,'18:00',2563,'confirmed',${booking.qr})`;
    for (const [id, email] of [[adminToken, owner], [helperToken, helper]]) await tx`INSERT INTO public.admin_sessions (id,email,valid_until) VALUES (${id},${email},NOW() + INTERVAL '30 minutes')`;
  });
  browser = await chromium.launch({ headless: true });
  for (const width of [360, 390, 1280]) {
    const context = await staffContext(adminToken, width);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', () => errors.push(true));
    await page.goto(`${origin}/admin`);
    await expect(page.getByRole('link', { name: 'Tickets scannen' })).toBeVisible();
    await noOverflow(page, `${width} overview`);
    await page.getByRole('button', { name: 'Veranstaltungen', exact: true }).click();
    await expect(page.getByText('Neues Event anlegen')).toBeVisible();
    await noOverflow(page, `${width} event list and creation`);
    await page.goto(`${origin}/admin/events/${eventId}`);
    await expect(page.getByRole('heading', { name: 'Gästeliste (3)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Einlass starten', exact: true })).toBeVisible();
    if (width < 768) { await expect(page.locator('article')).toHaveCount(3); await expect(page.getByRole('table')).toBeHidden(); }
    else { await expect(page.getByRole('table')).toBeVisible(); }
    await noOverflow(page, `${width} guests`);
    if (width === 390) await page.screenshot({ path: 'test-results/admin-role-browser/guests-mobile.png', fullPage: true });
    for (const tab of ['Event bearbeiten', 'Einstellungen', 'Tische & Zeltplan', 'Warteliste (0)', 'Einlass-Team']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await noOverflow(page, `${width} ${tab}`);
      if (width === 390 && tab === 'Einstellungen') await page.screenshot({ path: 'test-results/admin-role-browser/settings-mobile.png', fullPage: true });
    }
    await page.getByRole('button', { name: 'Einlass-Team', exact: true }).click();
    if (width === 390) {
      await page.getByLabel('E-Mail des Helfers').fill(helper);
      await page.getByLabel('Zugang bis einschließlich').fill('2026-10-15');
      await page.getByRole('button', { name: 'Scanner-Zugang freigeben' }).click();
      await expect(page.getByRole('status')).toContainText('Scanner-Zugang gespeichert');
      await expect(page.getByText(helper, { exact: true })).toBeVisible();
      await page.screenshot({ path: 'test-results/admin-role-browser/team-mobile.png', fullPage: true });
    }
    if (errors.length) throw new Error(`${width}: browser render error`);
    results.push({ scenario: `Admin ${width}px`, guestLayout: width < 768 ? 'cards' : 'table', noHorizontalOverflow: true, noBrowserErrors: true });
    await context.close();
  }
  const [grant] = await sql`SELECT id FROM public.scanner_access WHERE event_id=${eventId} AND email=${helper}`;
  if (!grant) throw new Error('UI did not persist the scanner grant');
  const adminRead = await invoke(adminToken, 'getReservationsByEvent', [eventId]);
  if (adminRead.status !== 200 || !adminRead.body.includes('Browser Gast 1')) throw new Error('Admin reservation action not available');
  const deniedActions = [
    ['getReservations', []], ['getReservationsByEvent', [eventId]],
    ['updateEvent', [eventId, { maxCapacity: 200 }]],
    ['updateReservationStatus', [bookings[0].id, 'cancelled']],
    ['assignTableToReservation', [bookings[0].id, null]],
    ['saveScannerAccess', [{ eventId: otherEventId, email: helper, validUntil: '2026-10-15T21:59:59Z' }]],
    ['removeScannerAccess', [eventId, grant.id]],
    ['checkInGuestByQR', [otherEventId, bookings[3].qr]],
  ];
  const deniedResponses = [];
  for (const [name, args] of deniedActions) {
    const response = await invoke(helperToken, name, args);
    if (!rejected(response)) {
      console.log({ action: name, status: response.status, contentType: response.contentType, urlPath: response.urlPath, redirect: response.redirect, hasError: /:E\{/.test(response.body), hasDigest: /digest/.test(response.body), hasGuest: response.body.includes('Browser Gast'), hasSuccess: response.body.includes('"success":true'), chars: response.body.length });
      throw new Error(`${name}: unauthorized helper action not rejected`);
    }
    deniedResponses.push({ action: name, status: response.status, reason: /:E\{/.test(response.body) ? 'authorization error' : 'action not publicly exported' });
  }
  if (!returned(await invoke(helperToken, 'scanTicket', [bookings[3].qr]), false)) throw new Error('Global scanner accepted another event');
  const [untouched] = await sql`SELECT status FROM public.reservations WHERE id=${bookings[3].id}`;
  const [event] = await sql`SELECT max_capacity FROM public.events WHERE id=${eventId}`;
  if (untouched.status !== 'confirmed' || event.max_capacity !== 100) throw new Error('Denied action mutated fixture data');
  results.push({ scenario: 'Helper direct Server Actions', deniedResponses, crossEventScannerRejected: true, deniedTicketUnchanged: true });

  const helperContext = await staffContext(helperToken, 390);
  const helperPage = await helperContext.newPage();
  await helperPage.goto(`${origin}/admin/scan`);
  await expect(helperPage.getByRole('heading', { name: 'Ticket Scanner' })).toBeVisible();
  if (await helperPage.locator('a[href="/admin"]').count()) throw new Error('Helper scanner links to management');
  await noOverflow(helperPage, 'helper scanner mobile');
  for (const route of ['/admin', `/admin/events/${eventId}`, `/admin/events/${eventId}/print`, `/admin/events/${otherEventId}/scanner`]) {
    await helperPage.goto(`${origin}${route}`);
    await expect(helperPage).toHaveURL(/\/admin\/scan$/);
    if ((await helperPage.locator('body').innerText()).includes('Browser Gast')) throw new Error('Protected page exposes guest details');
  }
  const first = await invoke(helperToken, 'checkInGuestByQR', [eventId, bookings[0].qr]);
  if (!returned(first, true) || first.body.includes('guest@example.com') || first.body.includes('amountTotal')) throw new Error('Scoped scanner failed or exposed management data');
  if (!returned(await invoke(helperToken, 'checkInGuestByQR', [eventId, bookings[0].qr]), false)) throw new Error('Duplicate check-in accepted');
  if (!returned(await invoke(helperToken, 'scanTicket', [bookings[1].qr]), true)) throw new Error('Global helper scan failed');
  results.push({ scenario: 'Helper access and check-in', protectedPagesRedirected: 4, bothScannerActionsAllowedForGrantedEvent: true, duplicateRejected: true, responseContainsNoEmailOrFinancialData: true });

  const ownerContext = await staffContext(adminToken, 390);
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${origin}/admin/events/${eventId}`);
  await ownerPage.getByRole('button', { name: 'Einlass-Team', exact: true }).click();
  await ownerPage.getByRole('button', { name: 'Widerrufen', exact: true }).click();
  await expect(ownerPage.getByRole('status')).toContainText('Scanner-Zugang widerrufen');
  await expect(ownerPage.getByText(helper, { exact: true })).toBeHidden();
  if (!rejected(await invoke(helperToken, 'scanTicket', [bookings[2].qr]))) throw new Error('Revoked helper session can still scan');
  await helperPage.goto(`${origin}/admin/scan`);
  await expect(helperPage).toHaveURL(/\/admin\/login$/);
  const [revokedTicket] = await sql`SELECT status FROM public.reservations WHERE id=${bookings[2].id}`;
  if (revokedTicket.status !== 'confirmed') throw new Error('Revoked helper mutated ticket');
  results.push({ scenario: 'Revocation through Admin UI', existingSessionBlockedImmediately: true, unscannedTicketUnchanged: true });
  await ownerContext.close(); await helperContext.close();
  await fs.writeFile('test-results/admin-role-browser/report.json', JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Local production server; temporary test sessions, test-database fixtures; no real OTP/mail/payment/camera acceptance', results }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  if (browser) await browser.close();
  await sql.begin(async tx => {
    await tx`DELETE FROM public.admin_sessions WHERE id IN (${adminToken},${helperToken})`;
    await tx`DELETE FROM public.scanner_access WHERE event_id IN (${eventId},${otherEventId})`;
    await tx`DELETE FROM public.reservations WHERE event_id IN (${eventId},${otherEventId})`;
    await tx`DELETE FROM public.events WHERE id IN (${eventId},${otherEventId})`;
  });
  await sql.end();
}
