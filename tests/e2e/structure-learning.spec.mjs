import {test,expect} from '@playwright/test';
import {mobileFixture} from '../fixtures/mobile-cards.mjs';
// Synthetic TSV isolates UI from OCR. Real pixels are tested separately below.
function tsv(f){return 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+f.source.observations.map((o,i)=>{const b=o.source.box;return [5,1,1,1,i+1,1,b.x0*f.width,b.y0*f.height,(b.x1-b.x0)*f.width,(b.y1-b.y0)*f.height,o.ocrConfidence,o.raw].join('\t');}).join('\n');}
async function imageBuffer(page,fixture,blank=false){return Buffer.from(await page.evaluate(({fixture,blank})=>{const c=document.createElement('canvas');c.width=fixture.width;c.height=fixture.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='24px Arial';if(!blank)for(const l of fixture.drawing)x.fillText(l.text,l.x,l.y);return c.toDataURL('image/png').split(',')[1];},{fixture,blank}),'base64');}
async function upload(page,f,stub=true){if(stub)await page.evaluate(data=>window.__tsv=data,tsv(f));const buffer=await imageBuffer(page,f,stub);await page.locator('#image').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer});await expect(page.locator('#message')).toContainText('Lähde-ehdotukset valmiit',{timeout:120000});}
async function teach(page){await page.locator('#teaching').evaluate(e=>e.open=true);await expect(page.locator('#teach')).toBeEnabled({timeout:2000});await page.locator('#entity').selectOption('1');const i=await page.locator('#identity option').nth(1).getAttribute('value'),q=await page.locator('#measure option').nth(1).getAttribute('value');await page.locator('#identity').selectOption(i);await page.locator('#measure').selectOption(q);await page.locator('#teach').click();}
for(const width of [320,360,393])test(`structure learning ${width}px: compact, explicit, repeated imports, no financial persistence`,async({page})=>{
 await page.setViewportSize({width,height:780});
 await page.route('**/vendor/ocr/tesseract.min.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{tsv:window.__tsv}}),terminate:async()=>{},reinitialize:async()=>{}})}'}));
 await page.goto('/demo/structure-learning.html');
 await upload(page,mobileFixture());await expect(page.locator('#count')).toContainText('0 lähde-ehdotusta');
 await expect(page.locator('select:visible')).toHaveCount(0);
 await teach(page);await expect(page.locator('#learningState')).toContainText('Alustava');
 await upload(page,mobileFixture());await teach(page);await expect(page.locator('#learningState')).toContainText('Alustava');
 await upload(page,mobileFixture({round:1}));await teach(page);await expect(page.locator('#learningState')).toContainText('kahdesta');
 await upload(page,mobileFixture({round:2}));await page.locator('#teaching').evaluate(e=>e.open=false);
 await expect(page.locator('#count')).toHaveText('3 lähde-ehdotusta · 0 estettyä kohtaa');
 await expect(page.locator('select:visible')).toHaveCount(0);
 const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,height:document.querySelector('#result').getBoundingClientRect().height}));
 expect(geometry.width).toBeLessThanOrEqual(width);expect(geometry.height).toBeLessThan(1000);
 await page.locator('#review').click();await expect(page.locator('#reviewState')).toContainText('Ei tallennusta');
 expect(await page.evaluate(()=>localStorage.length)).toBe(0);
 await page.locator('#save').evaluate(e=>e.closest('details').open=true);await page.locator('#save').click();
 const saved=await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'));
 for(const forbidden of ['Juniper','QJPA','Practice','sourceIds','box','hash','raw'])expect(saved).not.toContain(forbidden);
 await page.locator('#cancel').click();await expect(page.locator('#result')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'))).toBe(saved);
 await page.locator('#forget').click();expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});
test('storage denial rolls back teaching; cancel during OCR cannot restore a stale source',async({page})=>{
 await page.route('**/vendor/ocr/tesseract.min.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{tsv:window.__tsv}}),terminate:async()=>{},reinitialize:async()=>{}})}'}));
 await page.goto('/demo/structure-learning.html');await page.locator('#save').evaluate(e=>e.closest('details').open=true);await page.locator('#save').click();
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('QuotaExceededError');};});
 await upload(page,mobileFixture());await teach(page);await expect(page.locator('#message')).toContainText('Muutos ei onnistunut');
 expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'))).profiles).toEqual([]);
 await page.evaluate(()=>{window.Tesseract.createWorker=async()=>({recognize:()=>new Promise(resolve=>setTimeout(()=>resolve({data:{tsv:window.__tsv}}),300)),terminate:async()=>{},reinitialize:async()=>{}});});
 const f=mobileFixture(),buffer=await imageBuffer(page,f,true);
 await page.locator('#image').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer});await page.locator('#cancel').click();await page.waitForTimeout(500);await expect(page.locator('#result')).toBeHidden();
});
// These cases are deliberately part of the real-OCR opt-in suite, never counted as mock evidence.
for(const identity of ['ticker','isin'])for(const layout of ['en','fi'])test(`real pixels to mobile structures: ${layout} ${identity}`,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires staged same-origin Tesseract assets');test.setTimeout(240000);
 const external=[];await context.route('**/*',r=>{const u=new URL(r.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){external.push(u.hostname);return r.abort();}return r.continue();});
 await page.goto('/demo/structure-learning.html');
 if(layout==='en'){await page.locator('#language').evaluate(e=>e.closest('details').open=true);await page.locator('#language').selectOption('eng');await page.locator('#language').evaluate(e=>e.closest('details').open=false);}
 const measured=[];
 for(let round=0;round<3;round++){
  const f=mobileFixture({layout,round,identity});const started=Date.now();await upload(page,f,false);
  const before=await page.locator('#count').innerText();
  let taught=false;
  if(round<2){await page.locator('#teaching').evaluate(e=>e.open=true);for(const option of await page.locator('#card option').all()){await page.locator('#card').selectOption(await option.getAttribute('value'));if(await page.locator('#teach').isEnabled()){await teach(page);taught=true;break;}}}
  const actual=await page.locator('#rows article').evaluateAll(cards=>cards.map(c=>[...c.querySelectorAll('p')].map(p=>p.textContent)));
  const correct=f.oracle.filter(o=>actual.some(row=>row[0]===o.name && row[1]===`${o.qty} kpl · ${o.isin??(o.ticker+' / '+(layout==='fi'?'XHEL':'XNAS'))}`)).length;
  measured.push({round,expected:3,before,taught,correct,proposed:actual.length,falseProposals:actual.length-correct,sourceFieldSelections:taught?3:0,elapsedMs:Date.now()-started});

 }
 expect(external).toEqual([]);console.log('ISSUE38_REAL_OCR '+JSON.stringify({layout,identity,measured,externalRequests:external.length}));
 await info.attach('synthetic-mobile-result',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(measured[2].correct,'Real held-out recognition must match all three source rows').toBe(3);
 expect(measured[2].proposed).toBe(3);
});
