import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { verifyAuditChain } from '../src/lib/admin-audit';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
// ensure db module uses same? admin-audit uses db singleton from @/db which reads DATABASE_URL. Fine.

async function main() {
  const { ok, brokenAt } = await verifyAuditChain();
  if (ok) {
    console.log('Audit chain OK.');
  } else {
    console.error(`Audit chain BROKEN at id ${brokenAt}`);
    process.exit(1);
  }
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
