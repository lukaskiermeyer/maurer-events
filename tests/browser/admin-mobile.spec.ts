import { test, expect } from '@playwright/test';

test.describe('Disposable local admin acceptance', () => {
  test.skip(!process.env.ACCEPTANCE_ADMIN_TOKEN, 'Run via npm run test:acceptance with local fixtures.');
  test.beforeEach(async ({ context, baseURL }) => {
    expect(baseURL).toMatch(/^http:\/\/localhost:\d+$/);
    await context.addCookies([{ name: 'admin_token', value: process.env.ACCEPTANCE_ADMIN_TOKEN!, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
  });

  test('Dashboard, gallery dialog, populated waitlist and table editor fit narrow screens', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Deine Veranstaltungen' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Galerie', exact: true }).click();
      await page.getByRole('button', { name: 'Galerie-Album erstellen', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.getByRole('button', { name: 'Neues, leeres Album erstellen' }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await dialog.getByRole('button', { name: 'Album Speichern' }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole('button', { name: 'Album Speichern' })).toBeInViewport();
      await page.getByRole('button', { name: 'Dialog schließen' }).click();
      await page.goto(`/admin/events/${process.env.ACCEPTANCE_EVENT_ID}`);
      await page.getByRole('button', { name: 'Warteliste (1)', exact: true }).click();
      await expect(page.getByText('alexandra.beispiel.mit.langer.adresse@example.com')).toBeVisible();
      expect(await page.locator('.admin-waitlist').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      if (width === 390) await page.screenshot({ path: info.outputPath('waitlist-mobile.png'), fullPage: true });
      await page.getByRole('button', { name: 'Tische & Zeltplan', exact: true }).click();
      await expect(page.getByRole('button', { name: 'VIP ändern: Tisch 1', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (width < 640) {
        expect(await page.locator('input[type="number"]').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('16px');
      }
    }
    expect(errors).toEqual([]);
  });

  test('Gallery actions are accessible by touch and keyboard; VIP change persists', async ({ page, isMobile }, info) => {
    await page.goto(`/admin/events/${process.env.ACCEPTANCE_ALBUM_ID}`);
    await page.getByRole('button', { name: /📸 Galerie/ }).click();
    const removeButtons = page.getByRole('button', { name: 'Bild löschen' });
    await expect(removeButtons).toHaveCount(2);
    for (const remove of await removeButtons.all()) {
      if (!isMobile) await remove.focus();
      await expect(remove).toHaveCSS('opacity', '1');
      const box = await remove.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath('gallery-controls.png'), fullPage: true });
    await page.goto(`/admin/events/${process.env.ACCEPTANCE_EVENT_ID}`);
    await page.getByRole('button', { name: 'Tische & Zeltplan', exact: true }).click();
    page.once('dialog', dialog => dialog.accept('12,50'));
    await page.getByRole('button', { name: 'VIP ändern: Tisch 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'VIP ändern: Tisch 1', exact: true })).toBeEnabled();
    await page.reload();
    await page.getByRole('button', { name: 'Tische & Zeltplan', exact: true }).click();
    // The second browser project toggles the same fixture off again.
    if (info.project.name === 'chromium') await expect(page.getByText('VIP', { exact: true }).first()).toBeVisible();
  });

  test('Dashboard counts people and keeps revenue after check-in', async ({ page }) => {
    await page.goto('/admin');
    const guests = page.getByText('Bestätigte Gäste (Total)', { exact: true }).locator('..');
    await expect(guests.locator('.text-4xl')).toHaveText('5');
    const revenue = page.getByText('Erwarteter Umsatz', { exact: true }).locator('..');
    await expect(revenue.locator('.text-4xl')).toHaveText('125.00 €');
  });
});
