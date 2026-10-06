import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {chromium} from '@playwright/test';
async function main() {
  Object.assign(process.env,dotenv.parse(await fs.readFile('.env.local')));
  if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Test mode required');
  const {db}=await import('../src/db');
  const {sql}=await import('drizzle-orm');
  await db.execute(sql`SELECT 1 FROM public.admin_auth LIMIT 1`);
  console.log('Native Neon application driver can read public.admin_auth.');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.goto('https://maurer-events.madebylui.net/admin/login');
    console.log('Login page loaded.');
    await page.waitForFunction(()=>!!(document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement)?.value,{},{timeout:30000});
    console.log('CAPTCHA response fields:',await page.locator('input[name="cf-turnstile-response"]').count());
    const token=await page.locator('input[name="cf-turnstile-response"]').first().inputValue();
    console.log('Token obtained; loading CAPTCHA verifier.');
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY!,response:token})});
    const outcome=await response.json();
    console.log('CAPTCHA provider diagnosis:',JSON.stringify({success:outcome.success,hostname:outcome.hostname,action:outcome.action,errors:outcome['error-codes'],expectedHostname:new URL(process.env.NEXT_PUBLIC_BASE_URL!).hostname}));
    if(!outcome.success||outcome.hostname!==new URL(process.env.NEXT_PUBLIC_BASE_URL!).hostname||outcome.action!=='admin-login')throw new Error('CAPTCHA configuration mismatch');
    console.log('Real CAPTCHA hostname and action accepted.');
    const {takeRateLimit}=await import('../src/lib/rate-limit');
    console.log('Rate limit database update:',await takeRateLimit('acceptance-otp-diagnostic',5,900000));
    const {otpHash}=await import('../src/lib/admin-identity');
    console.log('AUTH_SECRET supports OTP hashing:',otpHash('hello@madebylui.net','000000').length===64);
  } finally {await browser.close()}
}
main().then(()=>process.exit(0)).catch(error=>{console.error('OTP diagnosis failed:',JSON.stringify({name:error?.name,code:error?.code,causeCode:error?.cause?.code,message:String(error?.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,500)}));process.exit(1)});
