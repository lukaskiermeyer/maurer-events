import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function testConnection() {
    console.log('🔍 Testing DB connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ set' : '❌ missing');

    try {
        const result = await db.execute(sql`SELECT 1 as test`);
        console.log('✅ DB connection successful:', result);
        process.exit(0);
    } catch (err) {
        console.error('❌ DB connection failed:', err instanceof Error ? err.message : 'Unknown error');
        console.error('Cause:', err instanceof Error ? err.cause : undefined);
        process.exit(1);
    }
}

testConnection();
