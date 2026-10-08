import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('Cleanup authenticates, validates results and never forwards secrets through redirects', async () => {
  let mode = 'success', requests = 0, leaked = false;
  const secret = 'local-acceptance-secret';
  const server = http.createServer((req, res) => {
    requests++;
    if (req.url !== '/api/cron/cleanup') leaked = true;
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    if (mode === 'redirect') { res.writeHead(302, { Location: '/different-target' }); res.end(); }
    else if (mode === 'http-error') { res.writeHead(503); res.end('Unavailable'); }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: mode === 'success' })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function run(extra = {}) {
    const child = spawn(process.execPath, ['scripts/run-cleanup.mjs'], {
      env: { ...process.env, CLEANUP_BASE_URL: origin, CRON_SECRET: secret, ...extra },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'close');
    assert.equal(output.includes(secret), false);
    return code;
  }
  try {
    assert.equal(await run(), 0);
    for (mode of ['http-error', 'invalid-result', 'redirect']) assert.notEqual(await run(), 0);
    assert.equal(requests, 4); assert.equal(leaked, false);
    assert.notEqual(await run({ CRON_SECRET: '' }), 0);
    assert.notEqual(await run({ CLEANUP_BASE_URL: 'http://unsafe.example' }), 0);
    assert.equal(requests, 4);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
