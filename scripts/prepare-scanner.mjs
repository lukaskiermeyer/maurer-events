// Ship the exact decoder used by the scanner locally, without a runtime CDN dependency.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const scannerRequire = createRequire(require.resolve('@yudiel/react-qr-scanner'));
const detectorPath = scannerRequire.resolve('barcode-detector/ponyfill');
const detectorRequire = createRequire(detectorPath);
const { ZXING_WASM_SHA256, ZXING_WASM_VERSION } = detectorRequire('barcode-detector/ponyfill');
const wasmPath = detectorRequire.resolve('zxing-wasm/reader/zxing_reader.wasm');
const wasm = await readFile(wasmPath);
if (createHash('sha256').update(wasm).digest('hex') !== ZXING_WASM_SHA256) {
  throw new Error('Scanner decoder binary does not match the installed detector.');
}
const output = new URL('../public/scanner/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('zxing_reader.wasm', output), wasm);
await writeFile(new URL('LICENSE.txt', output), await readFile(path.resolve(path.dirname(wasmPath), '../..', 'LICENSE')));
console.log(`Prepared local QR decoder (${ZXING_WASM_VERSION}).`);
