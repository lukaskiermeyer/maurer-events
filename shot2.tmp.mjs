import { chromium } from 'playwright';
const browser = await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto('http://localhost:3000/de',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(2000);
await page.screenshot({path:'C:/Users/lukas/AppData/Local/Temp/opencode/fog-above.png'});
const info=await page.evaluate(()=>{
  const fog=document.querySelector('.hero-fog');
  const tent=document.querySelector('.hero-tent');
  const fcs=getComputedStyle(fog);
  return {fogZ:fcs.zIndex, fogH:fcs.height, fogTop:fog.getBoundingClientRect().top, tentBottom:tent.getBoundingClientRect().bottom, fogExists:!!fog};
});
console.log(JSON.stringify(info));
await browser.close();
