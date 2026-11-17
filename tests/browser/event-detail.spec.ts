import { test, expect } from '@playwright/test';

test('Event detail page renders the tent stage in both languages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /#441|Ein unerwarteter Fehler|hydration/i.test(message.text())) errors.push(message.text()); });

  for (const prefix of ['', '/en']) {
    await page.goto(`${prefix}/termine`);
    const href = await page.locator('a[href*="/termine/"]').first().getAttribute('href');
    test.skip(!href, 'No events in the database');

    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Da ist etwas schiefgelaufen.');

    // Sidebar and back navigation are localized.
    await expect(page.getByRole('heading', { name: prefix === '/en' ? 'At a glance' : 'Auf einen Blick' })).toBeVisible();
    await expect(page.getByRole('link', { name: prefix === '/en' ? 'Back to overview' : 'Zurück zur Übersicht' })).toBeVisible();

    // No leftover hardcoded German labels on the English page.
    if (prefix === '/en') {
      await expect(page.locator('body')).not.toContainText('Event-Übersicht');
      await expect(page.locator('body')).not.toContainText('Rückblick');
    }

    // Tent ceiling and poster stage must not cause horizontal overflow.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('Event detail reservation anchor scrolls to the reservation section', async ({ page }) => {
  await page.goto('/termine');
  const href = await page.locator('a[href*="/termine/"]').first().getAttribute('href');
  test.skip(!href, 'No events in the database');
  await page.goto(href!);

  const cta = page.locator('a[href="#reservierung"]');
  if (await cta.count() > 0) {
    await expect(page.locator('#reservierung')).toHaveCount(1);
    await cta.click();
    await expect(page.locator('#reservierung')).toBeInViewport();
  }
});
