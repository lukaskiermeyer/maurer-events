import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { lt, isNull } from 'drizzle-orm';
import { adminChallenges, adminEnrollmentTokens, adminPasskeySessions } from '../src/db/schema';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function main() {
  const now = new Date();
  await db.delete(adminChallenges).where(lt(adminChallenges.expiresAt, now));
  await db.delete(adminEnrollmentTokens).where(lt(adminEnrollmentTokens.expiresAt, now));
  await db.delete(adminPasskeySessions).where(lt(adminPasskeySessions.idleExpiresAt, now));
  console.log('Cleanup done.');
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
