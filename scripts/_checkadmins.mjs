import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const r = await sql`SELECT id,email,status,role,webauthn_user_id FROM admin_users`;
console.log(JSON.stringify(r, null, 2));
await sql.end();
"