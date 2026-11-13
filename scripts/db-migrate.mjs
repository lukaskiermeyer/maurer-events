import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migrations.');
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
try {
  await client`SELECT pg_advisory_lock(741983202)`;
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../src/db/migrations/', import.meta.url)) });
  console.log('Database migrations completed.');
} catch (e) {
  console.error('Database migration failed:', e);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}