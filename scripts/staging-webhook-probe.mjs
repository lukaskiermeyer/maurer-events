import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import Stripe from 'stripe';
const env=dotenv.parse(await fs.readFile('.env.local'));
if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Test mode required');
const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:'2026-06-24.dahlia',timeout:15000,maxNetworkRetries:0});
const db=postgres(env.DATABASE_URL,{max:1,connect_timeout:10});
try {
  const fixture=JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json','utf8'));
  const session=await stripe.checkout.sessions.retrieve(fixture.sessionId);
  console.log('Provider session:',JSON.stringify({status:session.status,paymentStatus:session.payment_status,test:!session.livemode}));
  const events=await stripe.events.list({type:session.status==='complete'?'checkout.session.completed':'checkout.session.expired',limit:100});
  const event=events.data.find(e=>e.data.object.id===session.id);
  if(event) {
    const payload=JSON.stringify(event);
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
    const statuses=[];
    for(let i=0;i<3;i++) {
      const response=await fetch(`${env.NEXT_PUBLIC_BASE_URL}/api/webhooks/stripe`,{method:'POST',body:payload,headers:{'Content-Type':'application/json','Stripe-Signature':signature},signal:AbortSignal.timeout(20000)});
      statuses.push(response.status);
    }
    const [{count}]=await db`SELECT count(*)::int AS count FROM public.stripe_events WHERE id=${event.id}`;
    const [reservation]=await db`SELECT status::text,ticket_sent_at FROM public.reservations WHERE id=${fixture.reservationId}`;
    const report={checkedAt:new Date().toISOString(),kind:'real Stripe event, locally generated valid signature; three deliveries',eventId:event.id,statuses,ledgerCount:count,reservation};
    await fs.writeFile('test-results/staging-webhook-probe.json',JSON.stringify(report,null,2));
    console.log('Webhook replay:',JSON.stringify(report));
  } else console.log('No completed/expired event for this session yet.');
  const legacy=await db`SELECT id,created_at FROM public.reservations WHERE status::text='pending' AND stripe_session_id IS NULL AND checkout_params IS NULL`;
  const review=[];
  if(legacy.length) {
    const oldest=Math.floor(Math.min(...legacy.map(r=>r.created_at.getTime()))/1000)-86400;
    let inspected=0;
    const found=new Map();
    for await(const item of stripe.checkout.sessions.list({created:{gte:oldest},limit:100})) {
      inspected++;
      for(const reservation of legacy)if(item.metadata?.reservationId===reservation.id||item.client_reference_id===reservation.id) {
        found.set(reservation.id,{sessionId:item.id,status:item.status,paymentStatus:item.payment_status});
      }
      if(inspected>=5000)throw new Error('Provider session lookup truncated; manual review required');
    }
    for(const reservation of legacy)review.push({reservationId:reservation.id,match:found.get(reservation.id)||null});
    await fs.writeFile('test-results/staging-legacy-review.json',JSON.stringify({checkedAt:new Date().toISOString(),inspected,review},null,2));
    console.log('Legacy provider review:',JSON.stringify({inspected,matched:review.filter(r=>r.match).length,unmatched:review.filter(r=>!r.match).length}));
  }
}finally{await db.end({timeout:3})}
