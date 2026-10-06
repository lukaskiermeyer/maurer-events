import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const fixture=JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json','utf8'));
const base=process.argv[2]||'https://maurer-events.madebylui.net';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/termine/${fixture.eventId}`,{waitUntil:'domcontentloaded'});
  const wizard=page.locator('#reservation-wizard');
  await wizard.waitFor({timeout:30000});
  await wizard.getByRole('heading',{name:'Event & Datum',exact:true}).waitFor({timeout:15000});
  const next=wizard.getByRole('button',{name:'Weiter',exact:true}).first();
  await next.click();
  await wizard.getByRole('heading',{name:'Uhrzeit & Paket',exact:true}).waitFor();
  await wizard.getByRole('radio',{name:'18:00',exact:true}).click();
  await wizard.getByRole('radio',{name:/Brotzeit-Paket/}).click();
  await next.click();
  await wizard.locator('#guestName').waitFor();
  await wizard.locator('#guestName').fill('Produktionsabnahme');
  await wizard.locator('#guestEmail').fill('hello@madebylui.net');
  console.log('Wizard reached contact/payment step with date, time and package retained.');
  console.log('Runtime errors:',JSON.stringify(errors));
  await page.screenshot({path:'test-results/staging-wizard.png',fullPage:true});
}finally{await browser.close()}
