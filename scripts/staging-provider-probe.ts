// Real Stripe test API + Resend to explicitly authorized recipient.
// Uses a dedicated staging fixture; never runs with a live Stripe key.
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {eq} from 'drizzle-orm';
import Stripe from 'stripe';
import {Resend} from 'resend';
import * as schema from '../src/db/schema';
import {createCheckoutService} from '../src/lib/checkout';
import type {db as appDb} from '../src/db';
async function main() {
Object.assign(process.env,dotenv.parse(await fs.readFile('.env.local')));
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Stripe test mode required');
const client=postgres(process.env.DATABASE_URL!,{max:1,connect_timeout:10});
const db=drizzle(client,{schema}) as unknown as typeof appDb;
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-06-24.dahlia',timeout:15000,maxNetworkRetries:1});
try {
  const id=randomUUID();
  await fs.mkdir('test-results',{recursive:true});
  const previous=await fs.readFile('test-results/staging-provider-fixture.json').catch(()=>null);
  if(previous)await fs.writeFile(`test-results/staging-provider-fixture-${Date.now()}.json`,previous);
  const date=new Date(Date.now()+7*86400000);date.setUTCHours(0,0,0,0);
  await db.insert(schema.events).values({id,title:'Produktionsabnahme – Stripe-Test',date,location:'Staging',description:'Dediziertes Abnahmeevent mit Stripe-Testzahlungen.',reservable:true,allowTableSelection:false,maxCapacity:4});
  await db.insert(schema.eventSettings).values({eventId:id,requireFullTable:false,maxBookingsPerEmail:10});
  const input={eventId:id,tableId:null,reservationDate:date.toISOString().slice(0,10),selectedTime:'18:00',selectedPackage:'brotzeit',guestCount:1,name:'Produktionsabnahme',email:'hello@madebylui.net',idempotencyKey:randomUUID(),turnstileToken:'provider-only-probe'};
  // CAPTCHA is deliberately excluded here; it is tested separately in the real browser.
  const checkout=createCheckoutService(db,stripe,async()=>{});
  const result=await checkout(input);
  const repeat=await checkout(input);
  if(result.url!==repeat.url)throw new Error('Provider idempotency failed');
  const [reservation]=await db.select().from(schema.reservations).where(eq(schema.reservations.eventId,id));
  const session=await stripe.checkout.sessions.retrieve(reservation.stripeSessionId!);
  console.log('Real Stripe test checkout created and identical retry succeeded; payment methods:',session.payment_method_types.join(', '));
  const email=process.argv.includes('--no-email')?{data:{id:null},error:null}:await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.EMAIL_FROM!,to:['hello@madebylui.net'],subject:'Maurer Events – Produktionsabnahme: Versandtest',text:'Dies ist der freigegebene Versandtest für die Produktionsabnahme. Bitte bestätige den Empfang.'},{idempotencyKey:`acceptance:${id}`});
  if(email.error)throw new Error('Resend delivery request rejected');
  if(!process.argv.includes('--no-email'))console.log('Real Resend email accepted for hello@madebylui.net. Inbox delivery remains to be confirmed.');
  await fs.writeFile('test-results/staging-provider-fixture.json',JSON.stringify({eventId:id,reservationId:reservation.id,sessionId:session.id,checkoutUrl:result.url,input,emailId:email.data?.id,scope:'real provider API; CAPTCHA excluded'},null,2));
}finally{await client.end({timeout:3});}
}
main().catch(error=>{console.error('Provider probe failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
