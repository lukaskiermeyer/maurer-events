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

test('Hero-Pendeln und Funkeln behalten ihre Bewegung ohne Framer Motion', async () => {
  const [sign, lights, scene, css] = await Promise.all([
    readFile('src/components/HeroPubSign.tsx', 'utf8'),
    readFile('src/components/HeroLights.tsx', 'utf8'),
    readFile('src/components/HeroScene.tsx', 'utf8'),
    readFile('src/app/globals.css', 'utf8'),
  ]);
  assert.ok(!sign.includes('framer-motion'));
  assert.ok(!lights.includes('framer-motion'));
  assert.ok(!sign.includes('useReducedMotion'));
  assert.ok(!lights.includes('useReducedMotion'));
  assert.ok(sign.includes('loading="eager"'));
  assert.ok(scene.includes('loading="eager"'));
  assert.match(css, /animation: hero-sign-sway 6s ease-in-out infinite/);
  assert.match(css, /@keyframes hero-sign-sway \{\s*0%, 100% \{ transform: rotate\(-2\.2deg\); \}\s*50% \{ transform: rotate\(2\.2deg\); \}/);
  assert.match(css, /transform-origin: 50% 8\.8%/);
  assert.match(css, /\.hero-sign-frame \{ animation: none; will-change: auto; \}/);
  assert.match(css, /animation: hero-twinkle 2\.6s ease-in-out 0s infinite/);
  assert.ok(lights.includes('animationDuration: `${duration}s`'));
  assert.ok(lights.includes('animationDelay: `${delay}s`'));
});

test('Responsive Bildgrößen entsprechen der tatsächlichen Gestaltung ohne Qualitätsverlust', async () => {
  const [about, partners] = await Promise.all([
    readFile('src/components/AboutSection.tsx', 'utf8'),
    readFile('src/components/PartnersSection.tsx', 'utf8'),
  ]);
  assert.ok(about.includes('sizes="(max-width: 639px) min(22rem, calc(100vw - 4rem)), 22rem"'));
  assert.ok(about.includes('quality={70}'));
  assert.ok(!about.includes('sizes="(max-width: 768px) 100vw, 400px"'));
  assert.ok(partners.includes('sizes="(max-width: 767px) 79px, 101px"'));
});

test('Yeseva One wird als kleinere, verlustfreie WOFF2-Datei geladen', async () => {
  const [layout, ttf, woff2] = await Promise.all([
    readFile('src/app/layout.tsx', 'utf8'),
    readFile('public/fonts/YesevaOne-Regular.ttf'),
    readFile('public/fonts/YesevaOne-Regular.woff2'),
  ]);
  assert.ok(layout.includes('YesevaOne-Regular.woff2'));
  assert.equal(woff2.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.ok(woff2.byteLength < ttf.byteLength);
});
