// User confirmed this database exclusively contains staging/test data.
// Release only the four unassociated legacy test holds after provider review.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
if(!process.argv.includes('--confirmed-test-database'))throw new Error('Staging-only confirmation required');
const env=dotenv.parse(await fs.readFile('.env.local'));
if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Stripe test mode required');
const review=JSON.parse(await fs.readFile('test-results/staging-legacy-review.json','utf8'));
if(review.review.length!==4||review.review.some(r=>r.match))throw new Error('Expected four unassociated legacy test holds');
const db=postgres(env.DATABASE_URL,{max:1,connect_timeout:10});
try {
  const changed=await db.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(741983201)`;
    const ids=review.review.map(r=>r.reservationId);
    const before=await tx`SELECT * FROM public.reservations WHERE id=ANY(${ids}) FOR UPDATE`;
    if(before.length!==4||before.some(r=>r.status!=='pending'||r.stripe_session_id||r.checkout_params))throw new Error('Legacy holds changed; review again');
    await fs.writeFile('.acceptance-backups/legacy-test-holds-before-release.json',JSON.stringify({review,before},null,2));
    return tx`UPDATE public.reservations SET status='cancelled',qr_code_text=NULL,pdf_url=NULL,updated_at=now() WHERE id=ANY(${ids}) RETURNING id,status`;
  });
  console.log('Cancelled four unassociated legacy test holds; original rows preserved.');
  await fs.writeFile('test-results/staging-legacy-release.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'explicitly authorized staging/test data only',changed},null,2));
}finally{await db.end({timeout:3})}
