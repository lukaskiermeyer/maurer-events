const origin = process.env.CLEANUP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
if (!origin || !process.env.CRON_SECRET) throw new Error('Cleanup requires a base URL and CRON_SECRET.');
const target = new URL('/api/cron/cleanup', origin);
if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) {
  throw new Error('Cleanup requires HTTPS, except for local container calls.');
}
try {
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    redirect: 'error',
    signal: AbortSignal.timeout(270_000),
  });
  if (!response.ok || (await response.json()).success !== true) throw new Error('Cleanup failed');
  console.log('Cleanup completed.');
} catch {
  // Do not leak provider responses, tokens or personal booking data into cron logs.
  console.error('Cleanup failed; check application health and server logs.');
  process.exitCode = 1;
}
