import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {eq} from 'drizzle-orm';
import Stripe from 'stripe';
import * as schema from '../src/db/schema';
import {reservationAdmin} from '../src/lib/reservation-admin';
import type {db as appDb} from '../src/db';
async function main() {
  Object.assign(process.env,dotenv.parse(await fs.readFile('.env.local')));
  if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Test mode required');
  const fixture=JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json','utf8'));
  const client=postgres(process.env.DATABASE_URL!,{max:1,connect_timeout:10});
  const db=drizzle(client,{schema}) as unknown as typeof appDb;
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-06-24.dahlia',timeout:15000,maxNetworkRetries:0});
  try {
    const [reservation]=await db.select().from(schema.reservations).where(eq(schema.reservations.id,fixture.reservationId));
    if(reservation.email!=='hello@madebylui.net')throw new Error('Authorized test recipient required');
    const payload=reservation.ticketEmailPayload as {attachments?:{content?:string}[]}|null;
    if(!reservation.ticketSentAt||!payload?.attachments?.[0]?.content||!reservation.qrCodeText)throw new Error('Confirmed sent ticket required');
    await fs.writeFile('test-results/staging-ticket.pdf',Buffer.from(payload.attachments[0].content,'base64'));
    const service=reservationAdmin(db);
    await service.scan(reservation.qrCodeText,fixture.eventId);
    let duplicateRejected=false;
    try {await service.scan(reservation.qrCodeText,fixture.eventId)} catch {duplicateRejected=true}
    if(!duplicateRejected)throw new Error('Duplicate scan accepted');
    console.log('Real staging ticket checked in once; duplicate scan rejected by application service. Authenticated UI still requires OTP.');
    const session=await stripe.checkout.sessions.retrieve(fixture.sessionId);
    if(session.livemode||session.payment_status!=='paid'||typeof session.payment_intent!=='string')throw new Error('Paid test session required');
    const refund=await stripe.refunds.create({payment_intent:session.payment_intent},{idempotencyKey:`acceptance-refund:${fixture.reservationId}`});
    const chargeId=typeof refund.charge==='string'?refund.charge:refund.charge?.id;
    const recent=await stripe.events.list({type:'charge.refunded',limit:100});
    const event=recent.data.find(e=>e.data.object.id===chargeId);
    if(!event)throw new Error('Refund event not visible yet; repeat webhook verification');
    const body=JSON.stringify(event);
    const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET!});
    const response=await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/stripe`,{method:'POST',body,headers:{'Content-Type':'application/json','Stripe-Signature':signature},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Refund webhook rejected');
    const [after]=await db.select().from(schema.reservations).where(eq(schema.reservations.id,fixture.reservationId));
    let refundedScanRejected=false;
    try {await service.scan(reservation.qrCodeText,fixture.eventId)}catch{refundedScanRejected=true}
    if(after.status!=='refunded'||after.qrCodeText||!refundedScanRejected)throw new Error('Refund did not invalidate ticket');
    const report={checkedAt:new Date().toISOString(),scope:'real provider refund and staging DB; check-in uses application service, not authenticated UI',reservationId:reservation.id,duplicateRejected,refundStatus:refund.status,reservationStatus:after.status,qrInvalidated:after.qrCodeText===null,refundedScanRejected};
    await fs.writeFile('test-results/staging-ticket-refund.json',JSON.stringify(report,null,2));
    console.log('Refund and ticket invalidation:',JSON.stringify(report));
  }finally{await client.end({timeout:3})}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Unknown error');process.exitCode=1});
