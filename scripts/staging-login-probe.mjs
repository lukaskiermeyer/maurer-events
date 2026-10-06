import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200))});
  await page.goto('https://maurer-events.madebylui.net/admin/login');
  await page.locator('input[type=email]').fill('hello@madebylui.net');
  await page.waitForFunction(()=>!!document.querySelector('input[name="cf-turnstile-response"]')?.value,{},{timeout:20000}).catch(()=>{});
  console.log('Real Turnstile token available:',await page.locator('input[name="cf-turnstile-response"]').evaluateAll(nodes=>nodes.some(n=>!!n.value)));
  console.log('Request OTP button enabled:',await page.getByRole('button',{name:'Code anfordern'}).isEnabled());
  console.log('Captcha/console diagnostics:',JSON.stringify(errors));
  console.log('Login content:',(await page.locator('body').innerText()).slice(0,700));
} finally {await browser.close()}
