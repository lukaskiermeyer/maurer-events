import { test, expect } from '@playwright/test';

test('Public images load and gallery proportions survive optimization and lightbox', async ({ page }, info) => {
  test.skip(!process.env.ACCEPTANCE_ALBUM_ID, 'Requires the disposable acceptance gallery.');
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.request().resourceType() === 'image' && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  const hero = page.getByAltText('Maurer Events Festwirt', { exact: true });
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const img of await page.locator('img').all()) {
    if (!await img.isVisible()) continue;
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await page.goto(`/galerie/${process.env.ACCEPTANCE_ALBUM_ID}`);
  const photos = page.getByAltText('Galerie Bild', { exact: true });
  await expect(photos).toHaveCount(2);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => photo.evaluate(el => {
      const img = el as HTMLImageElement;
      const box = img.getBoundingClientRect();
      return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight);
    })).toBeLessThan(0.02);
    await photo.click();
    const full = page.getByAltText('Galeriebild in voller Größe');
    await expect(full).toBeVisible();
    await expect.poll(() => full.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(full).toHaveCSS('object-fit', 'contain');
    expect(await full.evaluate(img => {
      const box = img.getBoundingClientRect();
      return box.width <= innerWidth && box.height <= innerHeight;
    })).toBe(true);
    await page.getByRole('button', { name: 'Bild schließen', exact: true }).click();
    await expect(full).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath('gallery-proportions.png'), fullPage: true });
  expect(failures).toEqual([]);
});
