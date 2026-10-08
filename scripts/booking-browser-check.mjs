// Actual reservation and confirmation components with local action fixtures.
// No payment, email, CAPTCHA request or application database is accessed.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const outputDir = path.resolve('test-results/booking-browser');
await fs.mkdir(outputDir, { recursive: true });
const cssFiles = (await fs.readdir('.next/static/chunks')).filter(file => file.endsWith('.css'));
const css = (await Promise.all(cssFiles.map(file => fs.readFile(`.next/static/chunks/${file}`, 'utf8')))).join('\n');
const fixtureDay = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const bundle = await build({
  bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import {useState,useEffect} from 'react';
    import {createRoot} from 'react-dom/client';
    import {NextIntlClientProvider} from 'next-intl';
    import Reservation from './src/components/ReservationSection';
    import Confirmation from './src/components/reservation/BookingConfirmation';
    import de from './messages/de.json';
    import en from './messages/en.json';
    const params=new URLSearchParams(location.search);
    const locale=params.get('locale')||'de';
    const day='${fixtureDay}';
    const nextDay=new Date(Date.parse(day)+86400000).toISOString().slice(0,10);
    const events=[
      {id:'table',title:'Festzelt',date:new Date(day),reservable:true,allowTableSelection:true,reservableDates:params.has('dates')?[day,nextDay]:undefined},
      {id:'party',title:'Party',date:new Date(day),reservable:true,allowTableSelection:false},
    ];
    function App(){
      const [state,setState]=useState(params.get('state')||'success');
      useEffect(()=>{const handler=()=>{if(window.confirmNextRefresh)setState('success')};window.addEventListener('test-refresh',handler);return()=>window.removeEventListener('test-refresh',handler)},[]);
      return <NextIntlClientProvider locale={locale} messages={locale==='en'?en:de} timeZone='Europe/Berlin'>
        {params.get('mode')==='wizard'?<Reservation initialEvents={events} initialSelectedEvent={params.get('event')||undefined}/>:<Confirmation state={state}/>} 
      </NextIntlClientProvider>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  plugins: [{ name: 'local-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/app\/actions\/(tables|eventSettings|waitlist)$/ }, args => ({ path: args.path, namespace: 'actions' }));
    builder.onLoad({ filter: /.*/, namespace: 'actions' }, () => ({ loader: 'js', contents: `
      export const getTables=async()=>[
        {id:'ten',name:'Tisch 10',capacity:10,positionX:0,positionY:0},
        {id:'eight',name:'Tisch 8',capacity:8,positionX:1,positionY:0}
      ];
      function answer(kind,eventId,date,value){
        if(!new URLSearchParams(location.search).has('deferred')) return Promise.resolve(value);
        return new Promise(resolve=>{
          window.bookingRequests ||= [];
          window.bookingRequests.push({kind,eventId,date,resolve});
        });
      }
      export const getBookedTableIds=(eventId,date)=>answer('booked',eventId,date,[]);
      export const getPublicEventSettings=eventId=>answer('settings',eventId,null,{requireFullTable:true});
      export const joinWaitlist=async()=>({success:true});
    ` }));
    builder.onResolve({ filter: /^@marsidev\/react-turnstile$/ }, () => ({ path: 'captcha', namespace: 'captcha' }));
    builder.onLoad({ filter: /.*/, namespace: 'captcha' }, () => ({ loader: 'js', contents: 'export const Turnstile=()=>null;' }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'router' }));
    builder.onLoad({ filter: /.*/, namespace: 'router' }, () => ({ loader: 'js', contents: `
      const router={refresh(){window.refreshCount=(window.refreshCount||0)+1;window.dispatchEvent(new Event('test-refresh'))}};
      export const useRouter=()=>router;
    ` }));
    builder.onResolve({ filter: /^@\/i18n\/routing$/ }, () => ({ path: 'link', namespace: 'link' }));
    builder.onLoad({ filter: /.*/, namespace: 'link' }, () => ({ loader: 'jsx', resolveDir: process.cwd(), contents: `
      import {useLocale} from 'next-intl';
      export function Link({href,children,...props}){const locale=useLocale();return <a href={(locale==='en'?'/en':'')+(href==='/'&&locale==='en'?'':href)} {...props}>{children}</a>}
    ` }));
  } }],
});
const server = http.createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/app.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const width of [390, 1440]) {
    for (const locale of ['de', 'en']) {
      for (const state of ['success', 'pending', 'unavailable']) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => sessionStorage.setItem('reservation-checkout-attempt', 'test-attempt'));
        await page.goto(`${origin}/?state=${state}&locale=${locale}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const steps = page.getByRole('listitem');
        await expect(steps).toHaveCount(state === 'unavailable' ? 0 : 2);
        await expect(page.getByRole('button', { name: locale === 'de' ? 'Status erneut prüfen' : 'Check status again' })).toHaveCount(state === 'success' ? 0 : 1);
        expect(await page.evaluate(() => sessionStorage.getItem('reservation-checkout-attempt'))).toBe(state === 'success' ? null : 'test-attempt');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByRole('link', { name: locale === 'de' ? 'Zur Startseite' : 'Back to home' })).toHaveAttribute('href', locale === 'de' ? '/' : '/en');
        if (state === 'success') await page.screenshot({ path: `${outputDir}/confirmation-${locale}-${width}.png`, fullPage: true });
        expect(errors).toEqual([]);
        results.push({ width, locale, state, steps: state === 'unavailable' ? 0 : 2, overflow: false, errors: 0 });
        await context.close();
      }
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${origin}/?state=pending`);
  await page.evaluate(() => { window.confirmNextRefresh = true; });
  await expect(page.getByRole('heading', { level: 1, name: 'Du bist dabei!' })).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => window.refreshCount)).toBe(1);
  results.push({ automaticRefresh: true, confirmedAfterRefresh: true });
  await context.close();

  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const summary = page.locator(width < 1024 ? 'details' : '.lg\\:col-span-4').first();
    const summaryCount = count => expect(summary).toContainText(`${count} Personen`);
    const next = () => page.getByRole('button', { name: 'Weiter', exact: true }).filter({ visible: true }).click();
    const back = () => page.getByRole('button', { name: 'Zurück', exact: true }).filter({ visible: true }).click();
    await page.goto(`${origin}/?mode=wizard&event=party`);
    await summaryCount(1);
    await next();
    await expect(page.getByRole('button', { name: 'Gästezahl verringern' })).toBeDisabled();
    await page.getByRole('button', { name: 'Gästezahl erhöhen' }).click();
    await summaryCount(2);
    await back();
    await page.getByRole('radio', { name: /Festzelt/ }).click();
    await summaryCount(10);
    await next();
    await page.getByRole('radio', { name: 'Tisch 8, 8 Personen, frei' }).click();
    await summaryCount(8);
    await next();
    await expect(page.getByRole('button', { name: 'Gästezahl verringern' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Gästezahl erhöhen' })).toBeDisabled();
    await expect(page.getByText('Du reservierst einen ganzen Tisch für 8 Personen. Die Gästezahl ist bereits für dich eingestellt.')).toBeVisible();
    await back();
    await page.getByRole('radio', { name: 'Tisch 10, 10 Personen, frei' }).click();
    await summaryCount(10);
    await back();
    await page.getByRole('radio', { name: /Party/ }).click();
    await summaryCount(1);
    await page.goto(`${origin}/?mode=wizard&event=table`);
    await summaryCount(10);
    await page.screenshot({ path: `${outputDir}/wizard-${width}.png`, fullPage: true });
    results.push({ width, tableDefault: 10, partyDefault: 1, tableCapacityApplied: true, eventChangesResetCount: true });
    await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const next = () => page.getByRole('button', { name: 'Weiter', exact: true }).filter({ visible: true }).click();
    const back = () => page.getByRole('button', { name: 'Zurück', exact: true }).filter({ visible: true }).click();
    const resolveRequest = async (kind, eventId, index, value) => {
      await expect.poll(() => page.evaluate(({kind,eventId}) => (window.bookingRequests || []).filter(r => r.kind === kind && r.eventId === eventId).length, {kind,eventId})).toBeGreaterThan(index);
      await page.evaluate(({kind,eventId,index,value}) => window.bookingRequests.filter(r => r.kind === kind && r.eventId === eventId)[index].resolve(value), {kind,eventId,index,value});
    };
    const settings = name => ({ requireFullTable: true, packages: [{ id: name, name, description: 'Testpaket', price: 25 }] });
    await page.goto(`${origin}/?mode=wizard&event=table&deferred=1`);
    await resolveRequest('booked', 'table', 0, []);
    await resolveRequest('settings', 'table', 0, settings('Altes Paket'));
    await next();
    await page.getByRole('radio', { name: 'Tisch 8, 8 Personen, frei' }).click();
    await next();
    await expect(page.getByRole('radio', { name: /Altes Paket/ })).toBeVisible();
    await back();
    await back();
    await page.getByRole('radio', { name: /Party/ }).click();
    await page.getByRole('radio', { name: /Festzelt/ }).click();
    await next();
    await expect(page.getByRole('heading', { name: 'Tisch auswählen', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Tisch 8/ })).toHaveCount(0);
    await resolveRequest('booked', 'table', 1, ['ten']);
    await expect(page.getByRole('radio', { name: 'Tisch 10, 10 Personen, belegt' })).toBeDisabled();
    await page.getByRole('radio', { name: 'Tisch 8, 8 Personen, frei' }).click();
    await next();
    await expect(page.getByRole('heading', { name: 'Uhrzeit & Paket', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Altes Paket/ })).toHaveCount(0);
    await resolveRequest('settings', 'table', 1, settings('Aktuelles Paket'));
    await expect(page.getByRole('radio', { name: /Aktuelles Paket/ })).toBeVisible();
    await resolveRequest('settings', 'party', 0, { ...settings('Verspätetes Paket'), requireFullTable: false });
    await resolveRequest('booked', 'party', 0, ['ten', 'eight']);
    await expect(page.getByRole('radio', { name: /Aktuelles Paket/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Verspätetes Paket/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Gästezahl verringern' })).toBeDisabled();
    await back();
    await expect(page.getByRole('radio', { name: 'Tisch 8, 8 Personen, frei' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: 'Tisch 10, 10 Personen, belegt' })).toBeDisabled();
    expect(errors).toEqual([]);
    results.push({ width, rapidEventSwitch: true, oldSettingsCleared: true, availabilityReloaded: true, lateResponsesIgnored: true });
    await page.goto(`${origin}/?mode=wizard&event=table&deferred=1&dates=1`);
    await resolveRequest('booked', 'table', 0, []);
    await resolveRequest('settings', 'table', 0, settings('Aktuelles Paket'));
    const dates = page.getByRole('radiogroup', { name: 'Wähle einen Tag' }).getByRole('radio');
    await dates.nth(0).click();
    await next();
    await expect(page.getByRole('radio', { name: 'Tisch 8, 8 Personen, frei' })).toBeEnabled();
    await back();
    await dates.nth(1).click();
    await dates.nth(0).click();
    await next();
    await expect(page.getByRole('heading', { name: 'Tisch auswählen', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Tisch 8/ })).toHaveCount(0);
    await resolveRequest('booked', 'table', 2, ['eight']);
    await expect(page.getByRole('radio', { name: 'Tisch 8, 8 Personen, belegt' })).toBeDisabled();
    await resolveRequest('booked', 'table', 1, ['ten']);
    await expect(page.getByRole('radio', { name: 'Tisch 10, 10 Personen, frei' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: 'Tisch 8, 8 Personen, belegt' })).toBeDisabled();
    expect(errors).toEqual([]);
    results.push({ width, initialDateDoesNotResetSameRequest: true, rapidDateSwitch: true, lateDateResponseIgnored: true });
    await context.close();
  }
  const appOrigin = process.argv.find(arg => arg.startsWith('--app-origin='))?.split('=')[1];
  if (appOrigin) {
    const page = await browser.newPage();
    for (const prefix of ['', '/en']) {
      const response = await page.goto(`${appOrigin}${prefix}/reservierung/erfolgreich`);
      expect(response.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      await page.goto(`${appOrigin}${prefix}/?success=true`);
      await expect(page).toHaveURL(`${appOrigin}${prefix}/reservierung/erfolgreich`);
    }
    await page.context().clearCookies();
    await page.goto(`${appOrigin}/reservierung/erfolgreich?session_id=invalid-test-session`);
    await page.getByRole('button', { name: 'Switch to English', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(`${appOrigin}/en/reservierung/erfolgreich?session_id=invalid-test-session`);
    await expect(page.getByRole('heading', { level: 1, name: 'Check your emails' })).toBeVisible();
    results.push({ actualNextRoutes: true, legacyCheckoutRedirect: true, noIndex: true, languageSwitchRetainsSession: true });
    await page.close();
  }
  await fs.writeFile(`${outputDir}/report.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.length, report: `${outputDir}/report.json` }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
