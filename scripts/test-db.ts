import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env.local');
  process.exit(1);
}

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1, // Nur 1 Connection für Tests
  idle_timeout: 5,
  connect_timeout: 10,
});

// Test-Funktion
async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log('✅ DB connection successful:', result);
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ DB connection failed:', err instanceof Error ? err.message : 'Unknown error');
    await sql.end();
    process.exit(1);
  }
}

testConnection();
