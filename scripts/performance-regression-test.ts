import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import ContactSection from '../src/components/ContactSection';

test('Kontaktformular rendert initial ohne Captcha oder externes Script', async () => {
  const messages = JSON.parse(await readFile('messages/de.json', 'utf8'));
  const html = renderToString(createElement(NextIntlClientProvider, {
    locale: 'de',
    messages,
    timeZone: 'Europe/Berlin',
    now: new Date(),
    children: createElement(ContactSection),
  }));
  assert.ok(html.includes('Art der Veranstaltung'));
  assert.ok(!html.includes('challenges.cloudflare.com'));
  assert.ok(!html.includes('<iframe'));
});

test('Captcha und Dokumentendialog werden bedarfsgesteuert geladen', async () => {
  const contact = await readFile('src/components/ContactSection.tsx', 'utf8');
  const events = await readFile('src/components/EventsSection.tsx', 'utf8');
  assert.match(contact, /const Turnstile = dynamic\(/);
  assert.match(contact, /if \(nextStep !== step\) setTurnstileToken\(""\)/);
  assert.match(events, /const DocumentViewer = dynamic\(/);
  assert.match(events, /\{documentView && \(/);
});

test('Hero-Einstieg benötigt keine Hydration und respektiert Reduced Motion', async () => {
  const hero = await readFile('src/components/HeroSection.tsx', 'utf8');
  const css = await readFile('src/app/globals.css', 'utf8');
  assert.ok(!hero.startsWith('"use client"'));
  assert.ok(!hero.includes('framer-motion'));
  assert.ok(hero.includes('hero-actions'));
  assert.ok(css.includes('@keyframes hero-actions-in'));
  assert.ok(css.includes('transform: translateY(16px)'));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.hero-actions \{ animation: none; \}\s*\}/);
});
