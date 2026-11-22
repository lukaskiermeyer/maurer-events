const { config } = require('dotenv');
config({ path: '.env.local' });
const postgres = require('postgres');
const s = postgres(process.env.DATABASE_URL, { max: 1 });
s`UPDATE admin_users SET webauthn_user_id=replace(webauthn_user_id,'=','') WHERE webauthn_user_id LIKE '%=%'`
  .then(() => { console.log('ok'); return s.end(); })
  .catch(e => { console.error(e); process.exit(1); });