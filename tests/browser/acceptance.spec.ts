import { test, expect } from '@playwright/test';

test('German and English pages hydrate without application errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /#441|Ein unerwarteter Fehler|hydration/i.test(message.text())) errors.push(message.text()); });
  for (const route of ['/', '/en']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HOPPLA!' })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Da ist etwas schiefgelaufen.');
  }
  expect(errors).toEqual([]);
});

test('Admin, event dashboard and scanners require login', async ({ page }) => {
  for (const route of ['/admin', '/admin/events/00000000-0000-4000-8000-000000000000', '/admin/scan', '/admin/events/00000000-0000-4000-8000-000000000000/scanner']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  }
  await expect(page.getByText('Admin Login Skip')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Code anfordern'})).toBeDisabled();
});

test('Public checkout, webhook and cron reject invalid callers', async ({ request }) => {
  expect((await request.get('/api/cron/cleanup')).status()).toBe(401);
  expect((await request.post('/api/checkout', {data:{},headers:{Origin:'https://invalid.example'}})).status()).toBe(403);
  expect((await request.post('/api/checkout', {data:{}})).status()).toBe(400);
  expect((await request.post('/api/webhooks/stripe', {data:{},headers:{'Stripe-Signature':'invalid'}})).status()).toBe(400);
});

test('Readiness is uncached and security headers are present', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(health.headers()['cache-control']).toContain('no-store');
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(home.headers()['x-frame-options']).toBe('DENY');
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});
