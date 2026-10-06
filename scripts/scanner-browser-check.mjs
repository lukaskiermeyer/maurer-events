// Exercise the actual scanner clients with an issued-ticket camera image. Actions
// are replaced only in this local harness: no authentication bypass in the app,
// and no real check-in, database mutation, payment or email.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium, devices, expect } from '@playwright/test';
import nextConfig from '../next.config.mjs';

const outputDir = path.resolve('test-results/scanner-browser');
await fs.mkdir(outputDir, { recursive: true });
const { expectedQr } = JSON.parse(await fs.readFile('test-results/scanner-ticket-private.json', 'utf8'));
const configHeaders = await nextConfig.headers();
const csp = configHeaders.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value;
const common = { bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, write: false };
const oldBundle = await build({ ...common, stdin: { resolveDir: process.cwd(), contents: `
  import {createRoot} from 'react-dom/client';
  import {Scanner} from '@yudiel/react-qr-scanner';
  window.scanCount=0; window.detectorErrors=0;
  createRoot(document.getElementById('root')).render(<Scanner formats={['qr_code']} onScan={()=>window.scanCount++} onError={()=>window.detectorErrors++}/>);
`, loader: 'tsx' } });
const fixedBundle = await build({ ...common, stdin: { resolveDir: process.cwd(), contents: `
  import {createRoot} from 'react-dom/client';
  import EventScanner from './src/app/[locale]/admin/events/[id]/scanner/ScannerClient';
  import GlobalScanner from './src/app/[locale]/admin/scan/ScanClient';
  window.scanCount=0; window.valueMatched=false;
  createRoot(document.getElementById('root')).render(location.pathname.includes('global') ? <GlobalScanner/> : <EventScanner eventId='test-event'/>);
`, loader: 'tsx' }, plugins: [{ name: 'local-action-stubs', setup(builder) {
  builder.onResolve({ filter: /@\/app\/actions\/(reservations|scanner)$/ }, args => ({ path: args.path, namespace: 'local-action-stub' }));
  builder.onLoad({ filter: /.*/, namespace: 'local-action-stub' }, () => ({ contents: `
    async function check(value) {
      window.scanCount++; window.valueMatched = value === window.expectedQr;
      await new Promise(resolve => setTimeout(resolve, 300));
      if (window.forceActionError) throw new Error('Test network failure');
      const details = {guestName:'Scanner Test', guestCount:1, tableName:'Testtisch'};
      return window.scanCount===1 ? {success:true,...details,data:details,message:'Ticket erfolgreich entwertet!'} : {success:false,error:'Ticket wurde bereits gescannt.'};
    }
    export const checkInGuestByQR = (id,value) => check(value);
    export const scanTicket = check;
  `, loader: 'js' }));
  builder.onResolve({ filter: /^@\/i18n\/routing$/ }, () => ({ path: 'local-link', namespace: 'local-link-stub' }));
  builder.onLoad({ filter: /.*/, namespace: 'local-link-stub' }, () => ({ contents: 'export const Link = ({children,...props}) => <a {...props}>{children}</a>;', loader: 'jsx', resolveDir: process.cwd() }));
} }] });

const server = http.createServer(async (req, res) => {
  if (req.url === '/app.js' || req.url === '/old.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end((req.url === '/old.js' ? oldBundle : fixedBundle).outputFiles[0].contents);
  } else if (req.url === '/scanner/zxing_reader.wasm') {
    res.setHeader('Content-Type', 'application/wasm');
    res.end(await fs.readFile('public/scanner/zxing_reader.wasm'));
  } else {
    res.setHeader('Content-Security-Policy', req.url === '/old' || req.url === '/without-wasm' ? csp.replace("'wasm-unsafe-eval'", '') : csp);
    res.setHeader('Permissions-Policy', 'camera=(self)');
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><style>body{margin:0;background:#18201a;color:white}#root{width:420px;max-width:100vw;height:700px}video{max-height:420px}button{padding:16px} .aspect-square{aspect-ratio:1}.relative{position:relative}.h-full{height:100%}.w-full{width:100%}.absolute{position:absolute}.inset-0{inset:0}</style></head><body><div id="root"></div><script src="${req.url === '/old' ? '/old.js' : '/app.js'}"></script></body></html>`);
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${path.resolve('test-results/scanner-camera.y4m')}`] });
const results = [];
try {
  const oldContext = await browser.newContext({ permissions: ['camera'] });
  const oldPage = await oldContext.newPage();
  let cdnBlocked = false;
  oldPage.on('console', message => { if (message.text().includes('fastly.jsdelivr.net') && /Content Security Policy/i.test(message.text())) cdnBlocked = true; });
  await oldPage.goto(`${origin}/old`);
  await expect.poll(() => oldPage.locator('video').evaluate(video => video.readyState)).toBeGreaterThan(1);
  await expect.poll(() => oldPage.evaluate(() => window.detectorErrors)).toBeGreaterThan(0);
  if (!cdnBlocked || await oldPage.evaluate(() => window.scanCount) !== 0) throw new Error('Original CDN/CSP failure not reproduced');
  results.push({ scenario: 'original production policy', videoVisible: true, decoderCdnBlocked: true, decoded: false });
  await oldContext.close();

  for (const device of [null, devices['Pixel 7']]) {
    for (const kind of ['event', 'global']) {
      const context = await browser.newContext({ ...(device || {}), permissions: ['camera'] });
      await context.addInitScript(value => { window.expectedQr = value; }, expectedQr);
      const page = await context.newPage();
      const errors = [];
      const externalDecoderRequests = [];
      page.on('pageerror', () => errors.push('browser-error'));
      page.on('request', request => { if (/jsdelivr|unpkg/.test(request.url())) externalDecoderRequests.push(true); });
      await page.goto(`${origin}/${kind}`);
      await expect(page.getByRole('heading', { name: kind === 'event' ? 'Zugang gewährt!' : 'Erfolgreich!' })).toBeVisible();
      if (!await page.evaluate(() => window.valueMatched)) throw new Error('Decoded value differs from issued ticket');
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => window.scanCount) !== 1) throw new Error('Concurrent camera frames triggered duplicate action');
      await page.getByRole('button', { name: kind === 'event' ? 'Weiter scannen' : 'Nächstes Ticket scannen' }).click();
      await expect(page.getByText('Ticket wurde bereits gescannt.')).toBeVisible();
      if (await page.evaluate(() => window.scanCount) !== 2 || errors.length || externalDecoderRequests.length) throw new Error('Scanner resume or decoder loading failed');
      results.push({ device: device ? 'Pixel 7 emulation' : 'Desktop Chrome', scanner: kind, issuedTicketDecoded: true, oneActionPerScan: true, sameTicketDetectedAfterResume: true, externalDecoderRequests: 0 });
      await context.close();
    }
  }

  const context = await browser.newContext({ permissions: ['camera'] });
  await context.addInitScript(value => { window.expectedQr = value; }, expectedQr);
  const page = await context.newPage();
  let failDecoder = true;
  await page.route('**/scanner/zxing_reader.wasm', route => failDecoder ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await page.goto(`${origin}/event`);
  await expect(page.getByRole('alert')).toContainText('QR-Erkennung konnte nicht gestartet werden');
  failDecoder = false;
  await page.getByRole('button', { name: 'Scanner neu starten' }).click();
  await expect(page.getByRole('heading', { name: 'Zugang gewährt!' })).toBeVisible();
  results.push({ scenario: 'decoder download failure', visibleError: true, restartRecovered: true });
  await context.close();

  const networkContext = await browser.newContext({ permissions: ['camera'] });
  await networkContext.addInitScript(value => { window.expectedQr = value; window.forceActionError = true; }, expectedQr);
  const networkPage = await networkContext.newPage();
  await networkPage.goto(`${origin}/global`);
  await expect(networkPage.getByText('Netzwerkfehler beim Scannen. Bitte versuche es erneut.')).toBeVisible();
  results.push({ scenario: 'action network exception', visibleError: true, processingReleased: true });
  await networkContext.close();

  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Actual scanner clients, production CSP, full issued-ticket synthetic camera; local action stubs, no actual check-in', results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
