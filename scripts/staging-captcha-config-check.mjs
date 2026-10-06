// Empty/invalid CAPTCHA responses are rejected before booking or email.
// Inspect fixed diagnostic codes only; never emit tokens or secret values.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
const target = 'https://maurer-events.madebylui.net';
const fixture = JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json', 'utf8'));
const request = async (withOrigin, token = '') => fetch(`${target}/api/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(withOrigin ? { Origin: target } : {}) },
  body: JSON.stringify({ ...fixture.input, idempotencyKey: randomUUID(), turnstileToken: token }),
  signal: AbortSignal.timeout(15000),
});
let response = await request(true);
let body = await response.json();
const originMatches = body.error !== 'Ungültiger Ursprung.';
if (!originMatches) {
  response = await request(false);
  body = await response.json();
}
const missing = response.status === 503 && body.error === 'Spam-Schutz ist nicht konfiguriert.';
const present = response.status === 400 && body.error === 'Bitte bestätige, dass du kein Roboter bist.';
let verification = 'not-checked';
let verificationCode;
if (present) {
  const invalidResponse = await request(false, 'acceptance-invalid-token');
  const invalidBody = await invalidResponse.json();
  if (typeof invalidBody.code === 'string' && /^captcha-[A-Za-z0-9-]+$/.test(invalidBody.code)) verificationCode = invalidBody.code;
  verification = invalidResponse.status === 400 && invalidBody.error === 'Spam-Schutz fehlgeschlagen.' ? 'provider-rejected-invalid-token' : invalidResponse.status === 503 && invalidBody.error === 'Verbindungsfehler beim Spam-Schutz.' ? 'verification-unavailable' : 'undetermined';
}
const report = { checkedAt: new Date().toISOString(), target, status: response.status, originMatches, runtimeSecret: missing ? 'missing' : present ? 'present' : 'undetermined', verification, verificationCode, scope: 'empty and invalid CAPTCHA rejection; no booking or email' };
await fs.writeFile('test-results/staging-captcha-config.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!present || !originMatches || verification !== 'provider-rejected-invalid-token') process.exitCode = 1;
