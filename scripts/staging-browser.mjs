import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('pageerror',error=>console.log('PAGE ERROR:',error.message,'digest:',error.digest||'none'));
  page.on('console',message=>{if(message.type()==='error')console.log('CONSOLE:',message.text().slice(0,600))});
  page.on('response',response=>{if(response.status()>=400)console.log('HTTP:',response.status(),new URL(response.url()).pathname)});
  const response=await page.goto(process.argv[2]||'https://maurer-events.madebylui.net/',{waitUntil:'domcontentloaded'});
  await page.locator('body').waitFor({state:'visible'});
  await page.getByText('LÄDT...', {exact:true}).waitFor({state:'hidden',timeout:20000}).catch(()=>console.log('Loading view persists'));
  console.log('Homepage:',response.status());
  const body=await page.locator('body').innerText();
  console.log('Visible content:',body.slice(0,1700));
  console.log('Links:',JSON.stringify(await page.locator('a[href*="termine/"]').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),text:n.textContent?.slice(0,80)})))));
  await page.screenshot({path:'test-results/staging-home.png',fullPage:true});
} finally {await browser.close()}
