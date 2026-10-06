// Explicitly authorized staging database only. Backup, local restore rehearsal,
// baseline verification and transactional additive migrations. Never drizzle push.
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';
if (!process.argv.includes('--confirmed-test-database')) throw new Error('Explicit staging-only flag required');
const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Stripe test mode required');
const backup = `.acceptance-backups/staging-before-security-${Date.now()}.json`;
await fs.mkdir('.acceptance-backups', {recursive:true});
const staging=postgres(env.DATABASE_URL,{max:1,connect_timeout:10});
const admin=postgres('postgres://reservation_test@127.0.0.1:55439/postgres',{max:1});
const localName=`staging_acceptance_${randomUUID().replaceAll('-','')}`;
let local,created=false;
try {
  await admin.unsafe(`CREATE DATABASE "${localName}"`);created=true;
  local=postgres(`postgres://reservation_test@127.0.0.1:55439/${localName}`,{max:1});
  const journal=JSON.parse(await fs.readFile('src/db/migrations/meta/_journal.json','utf8'));
  const baseline=JSON.parse(await fs.readFile('src/db/migrations/meta/0003_snapshot.json','utf8'));
  const verify=async db=>{
    const columns=await db`SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public'`;
    for(const table of Object.values(baseline.tables)) for(const column of Object.values(table.columns)) {
      const existing=columns.find(c=>c.table_name===table.name&&c.column_name===column.name);
      // This staging schema has all 0003 fields except its nullable selected_time.
      // It is repaired explicitly before recording the verified migration baseline.
      if(!existing&&table.name==='reservations'&&column.name==='selected_time')continue;
      if(!existing||(column.notNull&&existing.is_nullable!=='NO')) throw new Error(`Baseline mismatch: ${table.name}.${column.name}`);
      const expected={integer:'int4',boolean:'bool',real:'float4',timestamp:'timestamp',text:'text',uuid:'uuid',json:'json',jsonb:'jsonb',reservation_status:'reservation_status'}[column.type];
      if(expected&&existing.udt_name!==expected) throw new Error(`Baseline type mismatch: ${table.name}.${column.name}`);
    }
    const constraints=await db`SELECT c.conname,c.contype,c.confdeltype,t.relname AS table_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'`;
    for(const table of Object.values(baseline.tables)) {
      for(const name of [...Object.keys(table.uniqueConstraints),...Object.keys(table.checkConstraints)]) if(!constraints.some(c=>c.table_name===table.name&&c.conname===name)) throw new Error(`Baseline constraint missing: ${name}`);
      for(const [name,fk] of Object.entries(table.foreignKeys)) {
        const actual=constraints.find(c=>c.table_name===table.name&&c.conname===name);
        const deletion={restrict:'r',cascade:'c','set null':'n','no action':'a'}[fk.onDelete];
        if(!actual||actual.contype!=='f'||actual.confdeltype!==deletion) throw new Error(`Baseline foreign key mismatch: ${name}`);
      }
    }
    const enums=await db`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=pg_enum.enumtypid WHERE typname='reservation_status'`;
    for(const value of baseline.enums['public.reservation_status'].values) if(!enums.some(e=>e.enumlabel===value)) throw new Error(`Missing status: ${value}`);
  };
  await verify(staging);
  const tableOrder=['admin_auth','admin_sessions','settings','events','tables','event_settings','galleries','reservations','waitlists','stripe_events','security_rate_limits'];
  const existingTables=await staging`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  if(existingTables.some(t=>!tableOrder.includes(t.tablename)))throw new Error('Unknown public table; cannot guarantee complete application backup');
  const [{ledger: existingLedger}]=await staging`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS ledger`;
  const savedLedger=existingLedger?await staging`SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`:[];
  const savedData=await staging.begin('isolation level repeatable read read only',async tx=>{
    const data={};
    for(const table of tableOrder) {
      if(!existingTables.some(t=>t.tablename===table))continue;
      const [row]=await tx.unsafe(`SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM "public"."${table}" t`);
      data[table]=row.rows;
    }
    return data;
  });
  const schemaSql=[];
  const schemaEntries=existingLedger?journal.entries.filter(e=>savedLedger.some(a=>Number(a.created_at)===e.when)):journal.entries.slice(0,4);
  for(const entry of schemaEntries) {
    const migration=await fs.readFile(`src/db/migrations/${entry.tag}.sql`,'utf8');
    if(existingLedger&&savedLedger.find(a=>Number(a.created_at)===entry.when)?.hash!==createHash('sha256').update(migration).digest('hex'))throw new Error('Backup migration checksum mismatch');
    schemaSql.push(migration);
  }
  await fs.writeFile(backup,JSON.stringify({format:'application-logical-backup-v1',createdAt:new Date().toISOString(),schemaSql,data:savedData,migrationLedger:savedLedger}));
  console.log('Consistent application backup created:',backup);
  for(const migration of schemaSql)for(const statement of migration.split('--> statement-breakpoint'))if(statement.trim())await local.unsafe(statement);
  for(const table of tableOrder) {
    if(!savedData[table]?.length)continue;
    const columns=Object.keys(savedData[table][0]);
    if(columns.some(c=>!/^[a-z_]+$/.test(c)))throw new Error('Unexpected column identifier');
    const selection=columns.map(c=>`"${c}"`).join(',');
    await local.unsafe(`INSERT INTO "public"."${table}" (${selection}) SELECT ${selection} FROM json_populate_recordset(NULL::"public"."${table}", $1::json)`,[local.json(savedData[table])]);
    const [{count}]=await local.unsafe(`SELECT count(*)::int AS count FROM "public"."${table}"`);
    if(count!==savedData[table].length)throw new Error(`Restore count mismatch: ${table}`);
  }
  if(existingLedger) {
    await local`CREATE SCHEMA drizzle`;
    await local`CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
    for(const row of savedLedger)await local`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(${row.hash},${row.created_at})`;
  }
  console.log('Every application table restored with matching row count. Backup excludes provider roles and infrastructure.');
  const migrate=async db=>{
    await db.begin(async tx=>{
      await tx`SET LOCAL search_path = public`;
      await tx`SET LOCAL lock_timeout = '10s'`;
      await tx`SET LOCAL statement_timeout = '30s'`;
      await tx`SELECT pg_advisory_xact_lock(741983201)`;
      const [{ledger}]=await tx`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS ledger`;
      if(!ledger) {
        await verify(tx);
        await tx`ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS selected_time text`;
        await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
        await tx`CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
        for(const entry of journal.entries.slice(0,4)) {
          const hash=createHash('sha256').update(await fs.readFile(`src/db/migrations/${entry.tag}.sql`,'utf8')).digest('hex');
          await tx`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(${hash},${entry.when})`;
        }
      }
      const applied=await tx`SELECT hash,created_at FROM drizzle.__drizzle_migrations`;
      for(const entry of journal.entries.slice(4)) {
        const migration=await fs.readFile(`src/db/migrations/${entry.tag}.sql`,'utf8');
        const hash=createHash('sha256').update(migration).digest('hex');
        const previous=applied.find(a=>Number(a.created_at)===entry.when);
        if(previous) {if(previous.hash!==hash)throw new Error(`Migration checksum mismatch: ${entry.tag}`);continue;}
        for(const statement of migration.split('--> statement-breakpoint')) if(statement.trim())await tx.unsafe(statement);
        await tx`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(${hash},${entry.when})`;
      }
    });
  };
  await migrate(local);
  const [{count}]=await local`SELECT count(*)::int AS count FROM reservations`;
  console.log('Backup restored and migration rehearsal passed; preserved reservations:',count);
  await migrate(staging);
  const [{count:after}]=await staging`SELECT count(*)::int AS count FROM reservations`;
  console.log('Staging migrated successfully; preserved reservations:',after);
  await fs.writeFile('.acceptance-backups/staging-migration.json',JSON.stringify({checkedAt:new Date().toISOString(),backup,rehearsal:true,migrations:journal.entries.map(e=>e.tag),reservationsBefore:count,reservationsAfter:after},null,2));
} finally {
  if(local)await local.end({timeout:3});
  if(created)await admin.unsafe(`DROP DATABASE "${localName}"`);
  await admin.end({timeout:3});await staging.end({timeout:3});
}
