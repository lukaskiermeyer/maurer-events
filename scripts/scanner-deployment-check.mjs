// Read-only check of the decoder served by the selected deployment.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scannerRequire = createRequire(require.resolve('@yudiel/react-qr-scanner'));
const { ZXING_WASM_SHA256 } = scannerRequire('barcode-detector/ponyfill');
const baseUrl = process.argv[2] || 'http://localhost:3100';
const response = await fetch(new URL('/scanner/zxing_reader.wasm', baseUrl), { signal: AbortSignal.timeout(15000) });
const bytes = Buffer.from(await response.arrayBuffer());
const report = { checkedAt: new Date().toISOString(), status: response.status, type: response.headers.get('content-type'), bytes: bytes.length,
  binaryMatches: createHash('sha256').update(bytes).digest('hex') === ZXING_WASM_SHA256,
  wasmAllowed: response.headers.get('content-security-policy')?.includes("'wasm-unsafe-eval'") === true };
await fs.writeFile('test-results/scanner-deployment-check.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (response.status !== 200 || report.type !== 'application/wasm' || !report.binaryMatches || !report.wasmAllowed) process.exitCode = 1;
