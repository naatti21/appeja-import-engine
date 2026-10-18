import {test,expect} from '@playwright/test';
import {mobileFixture} from '../fixtures/mobile-cards.mjs';
async function png(page,f){return Buffer.from(await page.evaluate(f=>{
 const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='24px Arial';for(const l of f.drawing)x.fillText(l.text,l.x,l.y);return c.toDataURL().split(',')[1];},f),'base64');}
async function upload(page,f){await page.locator('#image').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:await png(page,f)});await expect(page.locator('#message')).toContainText('Lähde-ehdotukset valmiit',{timeout:60000});}
async function edit(page,text,field,value){
 await page.locator('#correction').evaluate(e=>e.open=true);
 const option=page.locator('#correctionLine option').filter({hasText:text}).first();await page.locator('#correctionLine').selectOption(await option.getAttribute('value'));
 await expect(page.locator('#originalText')).toContainText('A: Alkuperäinen havainto:');const original=await page.locator('#originalText').innerText();
 await expect.poll(()=>page.locator('#sourceCrop').evaluate(e=>e.width)).toBeGreaterThan(0);
 await page.locator('#correctionField').selectOption(field);await page.locator('#correctionValue').fill(value);await page.locator('#confirmCorrection').click();
 await expect(page.locator('#correctionStatus')).toContainText(value);await expect(page.locator('#originalText')).toHaveText(original);
}
async function teach(page){await page.locator('#teaching').evaluate(e=>e.open=true);await expect(page.locator('#teach')).toBeEnabled();await page.locator('#entity').selectOption('1');for(const k of ['identity','measure'])await page.locator('#'+k).selectOption(await page.locator('#'+k+' option').nth(1).getAttribute('value'));await page.locator('#teach').click();}
async function score(page,f,layout){const actual=await page.locator('#rows article').evaluateAll(cards=>cards.map(c=>[...c.querySelectorAll('p')].map(p=>p.textContent)));const correct=f.oracle.filter(o=>actual.some(r=>r[0]===o.name&&r[1]===`${o.qty} kpl · ${o.isin??o.ticker+' / '+(layout==='fi'?'XHEL':'XNAS')}`)).length;return {correct,wrong:actual.length-correct,withheld:f.oracle.length-actual.length};}
for(const layout of ['en','fi'])test(`real pixels: explicit ${layout} identity correction, repeated imports and private teaching`,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires same-origin OCR assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{if(new URL(r.request().url()).hostname!=='127.0.0.1'){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto('/demo/structure-learning.html');
 if(layout==='en'){await page.locator('#language').evaluate(e=>e.closest('details').open=true);await page.locator('#language').selectOption('eng');await page.locator('#language').evaluate(e=>e.closest('details').open=false);}
 const measurements=[];
 for(let round=0;round<3;round++){
  const f=mobileFixture({layout,round});await upload(page,f);const before=await score(page,f,layout);
  const corrected=layout==='fi'?f.oracle:f.oracle.slice(0,1);
  for(const o of corrected){const label=layout==='fi'?o.ticker.replace(/^Q/,'O'):o.ticker;await edit(page,`Ticker: ${label} MIC:`,'identity',`Ticker: ${o.ticker} MIC: ${layout==='fi'?'XHEL':'XNAS'}`);}
  if(round<2)await teach(page);
  const after=await score(page,f,layout);expect(after.wrong).toBe(0);
  if(round===2){expect(after.correct).toBe(3);expect(before.correct).toBe(layout==='fi'?0:2);}
  measurements.push({round,before,after,confirmedIdentityFields:corrected.length,teachingSelections:round<2?3:0});
 }
 expect(outside).toEqual([]);
 await page.locator('#save').evaluate(e=>e.closest('details').open=true);await page.locator('#save').click();
 const stored=await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'));
 for(const token of ['QJPA','OJPA','QCBT','Juniper','Practice-A','sourceIds','raw','box'])expect(stored).not.toContain(token);
 const download=page.waitForEvent('download');await page.locator('#export').click();const exported=await download;const stream=await exported.createReadStream();let text='';for await(const part of stream)text+=part;expect(JSON.parse(text)).toEqual(JSON.parse(stored));
 await page.locator('#correction').evaluate(e=>e.open=false);await page.locator('#teaching').evaluate(e=>e.open=false);
 await info.attach('corrected-synthetic-cards',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.locator('#cancel').click();await expect(page.locator('#originalText')).toHaveText('');await expect(page.locator('#correctionValue')).toHaveValue('');await expect(page.locator('#result')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'))).toBe(stored);
 console.log('ISSUE39_CORRECTION_EFFORT '+JSON.stringify({layout,measurements,externalRequests:outside.length}));
});

// Independent layout: Swedish labels, only one name line, a different account and venue,
// unseen names per import. The original 12-row comparator is not modified.
for(const language of ['eng','swe+eng'])test(`real pixels: Swedish labels and unseen fictional funds across repeated imports (${language})`,async({page})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires same-origin OCR assets');test.setTimeout(180000);
 await page.goto('/demo/structure-learning.html');await page.locator('#language').evaluate(e=>e.closest('details').open=true);await page.locator('#language').selectOption(language);
 const measurements=[];
 for(let round=0;round<2;round++){
  const f=mobileFixture({layout:'en',round,identity:'isin',ambiguous:false,account:'Independent-C'});
  const names=round?['Cedar Analytics Fund','Linden Systems','Willow Research']:['Glacier Research','Harbor Devices Fund','Aspen Analytics'];
  f.drawing.forEach(l=>{const i=f.oracle.findIndex(o=>o.name===l.text);if(i>=0)l.text=names[i];l.text=l.text.replace('Account:','Konto:').replace('Quantity:','Antal:').replace('Currency: USD','Valuta: SEK').replace('Current price:','Marknadspris:').replace('Day change:','Förändring:').replace('More','Visa mer').replace('Show sources','Visa mer').replaceAll('USD','SEK');});
  f.oracle.forEach((o,i)=>o.name=names[i]);await upload(page,f);const result=await score(page,f,'sv');measurements.push(result);
 }
 console.log('ISSUE39_SWEDISH_PIXELS '+JSON.stringify({language,measurements}));
 for(const result of measurements){expect(result.wrong).toBe(0);expect(result.correct).toBe(3);}
});
