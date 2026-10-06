import {chromium} from '@playwright/test';
import readline from 'node:readline/promises';
const interactive=process.argv.includes('--interactive');
const target=process.argv.slice(2).find(arg=>arg.startsWith('http')) || 'https://maurer-events.madebylui.net/admin/login';
const browser=await chromium.launch({headless:!interactive});
try {
  const page=await browser.newPage();
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Admin Login'}).waitFor({timeout:30000});
  await page.locator('input[type=email]').fill('hello@madebylui.net');
  if(interactive) {
    console.log('Visible acceptance browser ready. Complete the real CAPTCHA and email-code login in this window.');
    await page.waitForURL(/\/admin$/,{timeout:600000});
    const token=(await page.context().cookies()).find(cookie=>cookie.name==='admin_token');
    if(!token?.httpOnly || !token.secure || token.sameSite!=='Strict') throw new Error('Missing secure admin session flags');
    await page.context().storageState({path:'test-results/staging-admin-session.json'});
    console.log('Real OTP login complete. Secure session saved for authenticated acceptance checks.');
  } else {
  await page.waitForTimeout(1000);
  for(const frame of page.frames()) {
    if(frame.url().startsWith('https://challenges.cloudflare.com/')) {
      await frame.getByRole('checkbox').check({timeout:3000}).catch(()=>{});
    }
  }
  await page.waitForFunction(()=>!!document.querySelector('input[name="cf-turnstile-response"]')?.value,{},{timeout:20000});
  await page.getByRole('button',{name:'Code anfordern'}).click();
  await Promise.race([page.locator('input[maxlength="6"]').waitFor({timeout:20000}),page.getByText('Anmeldecode konnte nicht angefordert werden.').waitFor({timeout:20000}).then(()=>{throw new Error('OTP request failed; verify runtime AUTH_SECRET and EMAIL_FROM')})]);
  console.log('OTP email requested through real Staging UI. Waiting for code on stdin.');
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  const code=(await input.question('OTP: ')).trim();input.close();
  if(!/^\d{6}$/.test(code))throw new Error('Six-digit OTP required');
  await page.locator('input[maxlength="6"]').fill(code);
  await page.waitForFunction(()=>!!document.querySelector('input[name="cf-turnstile-response"]')?.value,{},{timeout:20000});
  await page.getByRole('button',{name:'Einloggen'}).click();
  await page.waitForURL(/\/admin$/,{timeout:20000});
  console.log('OTP login succeeded through real CAPTCHA, Server Action and secure cookie.');
  const cookies=await page.context().cookies();
  const token=cookies.find(c=>c.name==='admin_token');
  console.log('Session flags:',JSON.stringify({httpOnly:token?.httpOnly,secure:token?.secure,sameSite:token?.sameSite}));
  await page.context().storageState({path:'test-results/staging-admin-session.json'});
  console.log('Admin page:',(await page.locator('body').innerText()).slice(0,500));
  }
} finally {await browser.close()}
