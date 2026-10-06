// Read-only widget diagnosis. Never records CAPTCHA tokens, keys or OTPs.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';

const env = dotenv.parse(await fs.readFile('.env.local'));
const browser = await chromium.launch({ headless: true });
const report = { checkedAt: new Date().toISOString(), clientCodes: [], requestFailures: [], httpErrors: [], widgetTokenPresent: false, builtSiteKeyMatchesLocal: false, csp: '' };
try {
  const page = await browser.newPage();
  page.on('console', message => {
    if (/turnstile/i.test(message.text())) {
      for (const code of message.text().match(/\b\d{6}\b/g) || []) if (!report.clientCodes.includes(code)) report.clientCodes.push(code);
    }
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.hostname === 'challenges.cloudflare.com') report.requestFailures.push({ host: url.hostname, error: request.failure()?.errorText });
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname === 'challenges.cloudflare.com' && response.status() >= 400) report.httpErrors.push(response.status());
  });
  const response = await page.goto(`${env.NEXT_PUBLIC_BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
  report.csp = response.headers()['content-security-policy'] || '';
  await page.getByRole('heading', { name: 'Admin Login' }).waitFor({ timeout: 30000 });
  // Compare the public build key without emitting its value.
  for (const url of await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src))) {
    if (new URL(url).origin !== new URL(env.NEXT_PUBLIC_BASE_URL).origin) continue;
    const script = await page.request.get(url, { timeout: 10000 });
    if ((await script.text()).includes(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) report.builtSiteKeyMatchesLocal = true;
  }
  await page.waitForFunction(() => !!document.querySelector('input[name="cf-turnstile-response"]')?.value, {}, { timeout: 20000 }).then(() => { report.widgetTokenPresent = true; }).catch(() => {});
  await page.screenshot({ path: 'test-results/staging-turnstile.png' });
  await fs.writeFile('test-results/staging-turnstile-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
