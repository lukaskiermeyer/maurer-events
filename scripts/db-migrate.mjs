import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Deliberately do not load .env.local: the deployment must supply its own target.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migrations.');
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
try {
  // A session lock serializes release jobs. Use a direct DB URL, not a transaction pooler.
  await client`SELECT pg_advisory_lock(741983202)`;
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../src/db/migrations/', import.meta.url)) });
  console.log('Database migrations completed.');
} catch {
  console.error('Database migration failed. Check the database connection, migration ledger and database logs.');
  process.exitCode = 1;
} finally {
  // Closing the dedicated connection also releases the session lock on failure.
  await client.end({ timeout: 5 });
}
