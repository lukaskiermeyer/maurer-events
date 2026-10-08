import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Fallback für die Build-Phase, falls DATABASE_URL nicht gesetzt ist
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Standard PostgreSQL works with both Neon's pooled Vercel connection and a
// private PostgreSQL service in Coolify. No Neon WebSocket proxy is required.
// Disable prepared statements for transaction poolers; qualify tables in schema.ts
// instead of sending search_path startup options to the Neon pooler.
const client = postgres(databaseUrl, {
  max: 5,
  prepare: false,
  connect_timeout: 5,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});
export const db = drizzle({ client, schema });
