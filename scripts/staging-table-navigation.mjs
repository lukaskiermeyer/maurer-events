// Browser navigation only on the dedicated staging event; no checkout or waitlist submit.
import fs from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';
const fixture = JSON.parse(await fs.readFile('test-results/staging-table-fixture.json', 'utf8'));
const baseUrl = process.argv[2] || 'https://maurer-events.madebylui.net';
const browser = await chromium.launch({ headless: true });
const results = [];
let activePage;
try {
  for (const device of [null, devices['Pixel 7']]) {
    const context = await browser.newContext(device || {});
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}/termine/${fixture.eventId}`, { waitUntil: 'domcontentloaded' });
    const wizard = page.locator('#reservation-wizard');
    const visibleButton = name => wizard.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
    await wizard.getByRole('heading', { name: 'Event & Datum', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('#reservation-wizard button[role="radio"][aria-checked="true"]'));
    await visibleButton('Weiter').click();
    await wizard.getByRole('radio', { name: `${fixture.tableName}, ${fixture.capacity} Personen, frei`, exact: true }).click();
    await visibleButton('Weiter').click();
    await wizard.getByRole('radio', { name: '18:00', exact: true }).click();
    await wizard.getByRole('radio', { name: /Brotzeit-Paket/ }).click();
    await visibleButton('Weiter').click();
    await wizard.locator('#guestName').fill('Produktionsabnahme Tischwahl');
    await wizard.locator('#guestEmail').fill('hello@madebylui.net');
    for (const heading of ['Uhrzeit & Paket', 'Tisch auswählen', 'Event & Datum']) {
      await visibleButton('Zurück').click();
      await wizard.getByRole('heading', { name: heading, exact: true }).waitFor();
    }
    await visibleButton('Weiter').click();
    const table = wizard.getByRole('radio', { name: `${fixture.tableName}, ${fixture.capacity} Personen, frei`, exact: true });
    if (await table.getAttribute('aria-checked') !== 'true') throw new Error('Unchanged event reset selected table');
    await visibleButton('Weiter').click();
    const time = wizard.getByRole('radio', { name: '18:00', exact: true });
    if (await time.getAttribute('aria-checked') !== 'true') throw new Error('Unchanged table reset selected time');
    await visibleButton('Weiter').click();
    await wizard.locator('#guestName').waitFor();
    if (await wizard.locator('#guestName').inputValue() !== 'Produktionsabnahme Tischwahl') throw new Error('Wizard reset guest details');
    if (errors.length) throw new Error('Wizard browser errors');
    results.push({ device: device ? 'Pixel 7' : 'Desktop Chrome', tableRetained: true, timeRetained: true, guestRetained: true, errors });
    await context.close();
  }
  await fs.writeFile('test-results/staging-table-navigation.json', JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'table-selection forward/back navigation; no booking or provider calls', results }, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  if (activePage) {
    await activePage.screenshot({ path: 'test-results/staging-table-failure.png', fullPage: true }).catch(() => {});
    console.log('Table navigation page:', (await activePage.locator('body').innerText()).slice(-1600));
  }
  throw error;
} finally { await browser.close(); }
