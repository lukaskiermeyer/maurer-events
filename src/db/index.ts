import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Fallback für die Build-Phase, falls DATABASE_URL nicht gesetzt ist
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const sql = neon(databaseUrl);
export const db = drizzle({ client: sql, schema });