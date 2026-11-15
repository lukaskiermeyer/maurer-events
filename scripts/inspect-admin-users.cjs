require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
sql`SELECT id, email, created_by, created_at, pg_typeof(created_at) AS t FROM admin_users`
  .then((r) => { console.log(JSON.stringify(r, null, 2)); return sql.end(); })
  .catch((e) => { console.error(e); process.exit(1); });