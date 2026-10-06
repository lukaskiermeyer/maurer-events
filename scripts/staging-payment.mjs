import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const fixture=JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json','utf8'));
if(!fixture.sessionId.startsWith('cs_test_'))throw new Error('Stripe test session required');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  await page.goto(fixture.checkoutUrl,{waitUntil:'domcontentloaded'});
  await page.getByText('Karte',{exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:'test-results/stripe-checkout.png',fullPage:true});
  console.log((await page.locator('body').innerText()).slice(0,650));
  console.log('Inputs:',JSON.stringify(await page.locator('input').evaluateAll(inputs=>inputs.map(i=>({name:i.name,id:i.id,type:i.type,placeholder:i.placeholder})))));
  await page.locator('[data-testid="card-accordion-item-button"]').dispatchEvent('click');
  await page.locator('input').first().waitFor();
  await page.screenshot({path:'test-results/stripe-card.png',fullPage:true});
  console.log('Card fields:',JSON.stringify(await page.locator('input').evaluateAll(inputs=>inputs.map(i=>({name:i.name,id:i.id,type:i.type,placeholder:i.placeholder})))));
  if(process.argv.includes('--pay-test')) {
    await page.locator('#cardNumber').fill('4242424242424242');
    await page.locator('#cardExpiry').fill('1230');
    await page.locator('#cardCvc').fill('123');
    await page.locator('#billingName').fill('Produktionsabnahme');
    await page.getByRole('button',{name:'Zahlen',exact:true}).click();
    await page.waitForURL(url=>url.hostname==='maurer-events.madebylui.net',{timeout:45000});
    console.log('Stripe test payment returned to staging:',page.url());
    await page.screenshot({path:'test-results/stripe-paid-return.png',fullPage:true});
  }
}finally{await browser.close()}
