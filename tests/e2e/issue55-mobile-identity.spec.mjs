import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {issue55Fixture} from '../fixtures/issue55-name-role.mjs';
async function setup(page,context){
 const outside=[];await context.route('**/*',r=>{
  if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();
 });
 await page.setViewportSize({width:360,height:780});await page.goto('/demo/portfolio-identity-review.html');
 await page.evaluate(async()=>{
  const {mountPortfolioIdentityReview,recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');window.calls=[];
  mountPortfolioIdentityReview(document.getElementById('portfolioReview'),{recognize:async(file,options)=>{const result=await recognizeLocalPortfolioImage(file,options);window.readings=structuredClone(result);return result;},resolver:async payload=>{
   window.calls.push(payload);return {schema_version:'instrument-resolver-v1',query:payload.name,candidates:[]};
  }});
 });return outside;
}
async function png(page,f){return Buffer.from(await page.evaluate(f=>{
 const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.font='24px Arial';for(const l of f.drawing){x.fillStyle=l.color;x.fillText(l.text,l.x,l.y);}return c.toDataURL().split(',')[1];
},f),'base64');}
async function load(page,image){await page.locator('#portfolioFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:image});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();}
for(const mode of ['faint','absent','clean'])test('issue55 mobile actual PNG OCR and direct row choice '+mode,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(240000);
 const outside=await setup(page,context),fixture=issue55Fixture({mode}),image=await png(page,fixture);
 await load(page,image);await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});
 const observed=await page.locator('#pendingRows article > p:first-of-type').allTextContents();
 const evidence=await page.evaluate(async()=>{
  const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
  const {preparePortfolioIdentityReview}=await import('/src/portfolio-identity-review.mjs');
  const {primary,witness}=window.readings,raw=extractVisualPortfolioCorroborated(primary,witness);
  const safe=preparePortfolioIdentityReview(raw,primary);return {primary,witness,raw,safe};
 });
 await writeFile(info.outputPath('fictional-ocr-evidence.json'),JSON.stringify(evidence));
 await info.attach('fictional-ocr-evidence.json',{path:info.outputPath('fictional-ocr-evidence.json'),contentType:'application/json'});
 expect(evidence.safe.candidates).toEqual([]);expect(evidence.safe.canPersist).toBe(false);expect(evidence.safe.reconciliation.status).toBe('not-evaluable');
 expect(evidence.raw.reconciliation.status).toBe('pass');
 expect(observed).toEqual([mode==='clean'?'Amber Circuit':'Growth bucket','Copper Harbor','Silver Orchard']);
 expect(await page.evaluate(()=>window.calls)).toEqual([]);await expect(page.locator('#reviewedRows article')).toHaveCount(0);
 const first=page.locator('#pendingRows article').first();await expect(first.getByRole('img')).toHaveCount(1);
 const target=first.getByRole('button',{name:'Korjaa nimi',exact:true});await target.focus();await page.keyboard.press('Enter');
 const input=first.getByRole('textbox',{name:'Oikea instrumentin nimi'});await expect(input).toBeFocused();await expect(input).toHaveValue('');await input.fill('Amber Circuit');await input.press('Enter');
 await expect(page.locator('#reviewedRows article')).toHaveCount(1);await expect(page.locator('#pendingRows article')).toHaveCount(2);
 expect(await page.evaluate(()=>window.calls)).toEqual([]);
 const search=page.getByRole('button',{name:'Hae paikallisesta testihakemistosta'});await search.dblclick();
 await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([{name:'Amber Circuit'}]);
 await expect(page.getByText('Ei luotettavaa listaustulosta.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('button:visible').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().height>=44))).toBe(true);
 await page.screenshot({path:info.outputPath('mobile-review.png'),fullPage:true});
 await info.attach('mobile-review.png',{path:info.outputPath('mobile-review.png'),contentType:'image/png'});
 await writeFile(info.outputPath('fictional-source.png'),image);
 await info.attach('fictional-source.png',{path:info.outputPath('fictional-source.png'),contentType:'image/png'});
 console.log('ISSUE55_MOBILE '+JSON.stringify({mode,correctObserved:observed.filter(name=>fixture.oracle.some(o=>o.name===name)).length,falseRawProposals:observed.filter(name=>!fixture.oracle.some(o=>o.name===name)).length,withheld:0,automaticPromotions:0,manualIdentityDecisions:1,lookupActions:1,pending:2,externalHttpCalls:outside.length}));
 await page.getByRole('button',{name:'Kumoa valinta'}).click();await expect(page.locator('#pendingRows article')).toHaveCount(3);
 await page.locator('#pendingRows article').nth(1).getByRole('button',{name:'Jätä rivi pois'}).click();
 await expect(page.locator('#reviewedRows article')).toContainText('Copper Harbor');
 await expect(page.locator('#reviewedRows article')).toContainText('Rivi jätetty pois');
 await load(page,image);await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});await expect(page.locator('#reviewedRows article')).toHaveCount(0);
 expect(await page.evaluate(()=>window.calls)).toEqual([{name:'Amber Circuit'}]);
 await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();await expect(page.locator('article')).toHaveCount(0);await expect(page.locator('#portfolioImage')).not.toHaveAttribute('src',/.+/);
 expect(outside).toEqual([]);
});
test('issue55 late OCR after cancel and malformed resolver output cannot restore state',async({page,context})=>{
 const outside=await setup(page,context),f=issue55Fixture(),image=await png(page,f);
 await page.evaluate(async f=>{
  const {mountPortfolioIdentityReview}=await import('/demo/portfolio-identity-review.mjs');
  mountPortfolioIdentityReview(document.getElementById('portfolioReview'),{
   recognize:()=>new Promise(resolve=>{window.ocrCount=(window.ocrCount??0)+1;window.finishOcr=()=>resolve({primary:f.source,witness:structuredClone(f.source)});}),
   resolver:async payload=>{window.calls.push(payload);return {schema_version:'wrong',candidates:[{shortname:'<img src=x onerror=alert(1)>'}]};}
  });
 },f);
 await load(page,image);await expect.poll(()=>page.evaluate(()=>typeof window.finishOcr)).toBe('function');
 await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();await page.evaluate(()=>window.finishOcr());await expect(page.locator('article')).toHaveCount(0);
 await load(page,image);await expect.poll(()=>page.evaluate(()=>window.ocrCount)).toBe(2);await page.evaluate(()=>window.finishOcr());await expect(page.locator('#pendingRows article')).toHaveCount(3);
 await page.locator('#pendingRows article').nth(2).getByRole('button',{name:'Vahvista havaittu nimi'}).click();
 await page.getByRole('button',{name:'Hae paikallisesta testihakemistosta'}).click();await expect(page.getByText('Ei luotettavaa listaustulosta.')).toBeVisible();
 expect(await page.evaluate(()=>window.calls)).toEqual([{name:'Silver Orchard'}]);expect(outside).toEqual([]);
});

for(const transition of ['other-row','cancel','new-file'])test('PR59 pending lookup survives safely: '+transition,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(240000);
 const outside=await setup(page,context),image=await png(page,issue55Fixture({mode:'faint'}));
 await page.evaluate(async()=>{
  const {mountPortfolioIdentityReview}=await import('/demo/portfolio-identity-review.mjs');window.calls=[];window.pendingLookups=[];
  mountPortfolioIdentityReview(document.getElementById('portfolioReview'),{resolver:payload=>{
   window.calls.push(payload);return new Promise(resolve=>window.pendingLookups.push(()=>resolve({schema_version:'instrument-resolver-v1',query:payload.name,candidates:[{symbol:'SYNTH',shortname:payload.name,quote_type:'EQUITY',exchange:'XTEST'}]})));
  }});
 });
 async function correctFirst(){
  const row=page.locator('#pendingRows article').first();await row.getByRole('button',{name:'Korjaa nimi',exact:true}).click();
  await row.getByRole('textbox').fill('Amber Circuit');await row.getByRole('button',{name:'Vahvista korjattu nimi'}).click();
 }
 await load(page,image);await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});await correctFirst();
 const search=()=>page.getByRole('button',{name:'Hae paikallisesta testihakemistosta'});
 await search().dblclick();await expect.poll(()=>page.evaluate(()=>window.calls.length)).toBe(1);await expect(search()).toBeDisabled();
 if(transition==='other-row'){
  await page.locator('#pendingRows article').filter({hasText:'Copper Harbor'}).getByRole('button',{name:'Jätä rivi pois'}).click();
  await expect(search()).toBeDisabled();
  const third=page.locator('#pendingRows article').filter({hasText:'Silver Orchard'});
  await third.getByRole('button',{name:'Korjaa nimi',exact:true}).click();
  await third.getByRole('textbox').fill('Unsubmitted draft');
 }else{
  if(transition==='cancel'){await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();await page.evaluate(()=>window.pendingLookups[0]());await expect(page.locator('article')).toHaveCount(0);}
  await load(page,image);await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});await correctFirst();
 }
 await page.evaluate(()=>window.pendingLookups[0]());
 await expect(search()).toBeEnabled();await expect(page.getByText(/SYNTH/)).toHaveCount(0);
 if(transition==='other-row'){
  await expect(page.locator('#reviewedRows article').filter({hasText:'Copper Harbor'})).toContainText('Rivi jätetty pois');
  const draft=page.locator('#pendingRows article').filter({hasText:'Silver Orchard'}).getByRole('textbox');
  await expect(draft).toHaveValue('Unsubmitted draft');await expect(draft).toBeFocused();
 }
 await search().dblclick();await expect.poll(()=>page.evaluate(()=>window.calls.length)).toBe(2);
 await page.evaluate(()=>window.pendingLookups[1]());await expect(page.getByText(/SYNTH/)).toBeVisible();
 expect(await page.evaluate(()=>window.calls)).toEqual([{name:'Amber Circuit'},{name:'Amber Circuit'}]);
 if(transition==='other-row')await expect(page.locator('#reviewedRows article').filter({hasText:'Copper Harbor'})).toContainText('Rivi jätetty pois');
 await page.screenshot({path:info.outputPath('lookup-race.png'),fullPage:true});expect(outside).toEqual([]);
});
