import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const fixture=JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json','utf8'));
if(!fixture.sessionId.startsWith('cs_test_'))throw new Error('Stripe test session required');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  await page.goto(fixture.checkoutUrl,{waitUntil:'domcontentloaded'});
  await page.getByText(/Maurer|Produktionsabnahme/).first().waitFor({timeout:30000});
  await page.screenshot({path:'test-results/stripe-checkout.png',fullPage:true});
  console.log((await page.locator('body').innerText()).slice(0,650));
  console.log('Inputs:',JSON.stringify(await page.locator('input').evaluateAll(inputs=>inputs.map(i=>({name:i.name,id:i.id,type:i.type,placeholder:i.placeholder})))));
  await page.getByText('Karte',{exact:true}).click();
  await page.screenshot({path:'test-results/stripe-card.png',fullPage:true});
  console.log('Card fields:',JSON.stringify(await page.locator('input').evaluateAll(inputs=>inputs.map(i=>({name:i.name,id:i.id,type:i.type,placeholder:i.placeholder})))));
}finally{await browser.close()}
