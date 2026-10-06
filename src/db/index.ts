import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

// Fallback für die Build-Phase, falls DATABASE_URL nicht gesetzt ist
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Neon pooled endpoints reject search_path in startup options. ORM table names
// are explicitly qualified in schema.ts instead of changing pooled session state.
const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000, max: 10 });
pool.on('error', error => console.error('Idle database connection failed:', error.name));
export const db = drizzle({ client: pool, schema });
