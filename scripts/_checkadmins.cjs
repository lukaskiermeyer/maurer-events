const { config } = require('dotenv');
config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
sql`SELECT id,email,status,role,webauthn_user_id FROM admin_users`.then(r => {
  console.log(JSON.stringify(r, null, 2));
  return sql.end();
}).catch(e => { console.error(e); process.exit(1); });