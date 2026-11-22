import fs from 'node:fs';
const p='src/db/migrations/0035_admin_passkey_auth.sql';
let s=fs.readFileSync(p,'utf8');
const bad="replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '', 'system'";
const good="replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''), 'system'";
const n=s.split(bad).length-1;
s=s.split(bad).join(good);
fs.writeFileSync(p,s);
console.log('replaced', n);
"