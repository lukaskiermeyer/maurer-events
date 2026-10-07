// Decode locally rendered complete ticket PDFs, without provider calls.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
prepareZXingModule({ overrides: { wasmBinary: await fs.readFile(require.resolve('zxing-wasm/reader/zxing_reader.wasm')) } });
const results = [];
for (const name of ['normal', 'long']) {
  const { data, info } = await sharp(`test-results/ticket-layout-${name}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: 'srgb' }, { formats: ['QRCode'] });
  if (found.length !== 1 || found[0].text !== '12345678-1234-4234-8234-123456789abc') throw new Error('Rendered ticket QR differs or is unreadable');
  results.push({ fixture: name, completePdfDecoded: true, exactCode: true });
}
await fs.writeFile('test-results/ticket-decoder-report.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
