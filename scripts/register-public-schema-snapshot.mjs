import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const root='src/db/migrations';
const before=JSON.parse(await fs.readFile(`${root}/meta/0006_snapshot.json`,'utf8'));
const after=JSON.parse(await fs.readFile('test-results/public-schema-snapshot/meta/0000_snapshot.json','utf8'));
const normalized=structuredClone(before);
for(const table of Object.values(normalized.tables))table.schema='public';
const clean=s=>{
  const c=structuredClone(s);delete c.id;delete c.prevId;
  const normalize=value=>{
    if(typeof value==='string')return value.replaceAll('"public".','');
    if(Array.isArray(value))return value.map(normalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k,v])=>!(k==='schemaTo'&&v==='public')).map(([k,v])=>[k,normalize(v)]));
    return value;
  };
  return normalize(c);
};
if(JSON.stringify(clean(normalized))!==JSON.stringify(clean(after))) {
  const differences=[];
  const walk=(a,b,p)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],`${p}.${k}`)}else differences.push({path:p,before:a,after:b})};
  walk(clean(normalized),clean(after),'snapshot');
  console.log(JSON.stringify(differences,null,2));
  throw new Error('Additional schema differences require review');
}
after.id=randomUUID();after.prevId=before.id;
const journal=JSON.parse(await fs.readFile(`${root}/meta/_journal.json`,'utf8'));
if(journal.entries.length!==7)throw new Error('Unexpected journal state');
journal.entries.push({idx:7,version:'7',when:Date.now(),tag:'0007_explicit_public_schema',breakpoints:true});
await fs.writeFile(`${root}/0007_explicit_public_schema.sql`,'-- Tables already reside in public. This records explicit ORM schema qualification.\n-- No data, tables, constraints or enum values are changed.\nSELECT 1;\n');
await fs.writeFile(`${root}/meta/0007_snapshot.json`,JSON.stringify(after,null,2)+'\n');
await fs.writeFile(`${root}/meta/_journal.json`,JSON.stringify(journal,null,2)+'\n');
console.log('Registered metadata-only public-schema snapshot; physical database unchanged.');
