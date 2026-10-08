import fs from 'node:fs/promises';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const bundle = await build({
  stdin: { contents: "import { uploadImage } from './src/lib/client-image-upload'; window.uploadImage = uploadImage;", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  plugins: [{ name: 'local-upload-action', setup(builder) {
    builder.onResolve({ filter: /^@\/app\/actions\/upload$/ }, () => ({ path: 'action', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export async function uploadImage(data) {
        const file=data.get('file'), bitmap=await createImageBitmap(file);
        const result={success:true,size:file.size,type:file.type,width:bitmap.width,height:bitmap.height};
        bitmap.close(); window.actionCalls=(window.actionCalls||0)+1; return result;
      }
    ` }));
  } }],
});
const server = http.createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    async function upload(file) { const data = new FormData(); data.append('file', file); return window.uploadImage(data); }
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1000;
    const context = canvas.getContext('2d'); const pixels = context.createImageData(canvas.width, canvas.height);
    let value = 19;
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let c = 0; c < 3; c++) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; pixels.data[i+c] = value >>> 24; }
      pixels.data[i+3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const large = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const largeResult = await upload(new File([large], 'phone.png', { type: 'image/png' }));
    canvas.width = 3000; canvas.height = 1500; context.fillRect(0, 0, 3000, 1500);
    const wide = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const wideResult = await upload(new File([wide], 'wide.png', { type: 'image/png' }));
    const invalid = await upload(new File(['invalid'], 'file.heic', { type: 'image/heic' }));
    const oversize = await upload(new File([new Uint8Array(10*1024*1024+1)], 'huge.jpg', { type: 'image/jpeg' }));
    const corrupt = await upload(new File(['broken'], 'broken.jpg', { type: 'image/jpeg' }));
    return { originalSize: large.size, largeResult, wideResult, invalid, oversize, corrupt, actionCalls: window.actionCalls };
  });
  expect(result.originalSize).toBeGreaterThan(3 * 1024 * 1024);
  expect(result.largeResult.success).toBe(true);
  expect(result.largeResult.size).toBeLessThan(3 * 1024 * 1024);
  expect(result.largeResult.type).toBe('image/webp');
  expect(result.wideResult.width).toBe(1920); expect(result.wideResult.height).toBe(960);
  for (const invalid of [result.invalid, result.oversize, result.corrupt]) expect(invalid.success).toBe(false);
  expect(result.actionCalls).toBe(2);
  await fs.mkdir('test-results/image-upload', { recursive: true });
  await fs.writeFile('test-results/image-upload/report.json', JSON.stringify(result, null, 2));
  console.log('PASS image compression, proportional resize, invalid type, size and corrupt-file rejection. No provider calls.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
