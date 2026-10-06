import { config } from 'dotenv';
config({ path: '.env.local' });

// Workaround for Node.js native WebSocket issue in local testing
import { neonConfig } from '@neondatabase/serverless';
try {
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
  console.log('Using ws module for local test');
} catch (e) {
  // Ignore
}

async function main() {
  const { db } = await import('@/db/index');
  console.log('Starting transaction test...');
  const url = process.env.DATABASE_URL;
  if (url) {
    console.log('DB URL Host:', new URL(url).hostname);
  } else {
    console.log('DB URL: not set');
  }
  
  try {
    await db.transaction(async (tx) => {
      console.log('Inside transaction, executing query...');
      // Executing a harmless SELECT 1
      const result = await tx.execute('SELECT 1 as test');
      console.log('Query result:', result.rows);
      if (result.rows[0].test === 1) {
        console.log('Transaction test successful!');
      } else {
        console.log('Unexpected result:', result.rows);
      }
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
