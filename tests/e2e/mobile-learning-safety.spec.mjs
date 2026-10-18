import {test,expect} from '@playwright/test';
import {mobileFixture} from '../fixtures/mobile-cards.mjs';

async function image(page,fixture){return Buffer.from(await page.evaluate(f=>{
 const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');
 x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='24px Arial';
 for(const line of f.drawing)x.fillText(line.text,line.x,line.y);
 return c.toDataURL().split(',')[1];
},fixture),'base64');}
async function localOnly(context){const requests=[];await context.route('**/*',r=>{
 if(new URL(r.request().url()).hostname!=='127.0.0.1'){requests.push(r.request().url());return r.abort();}
 return r.continue();
});return requests;}

test('P0 real OCR: swapped rows and repeated wrong teaching never emit a heading',async({page,context})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=await localOnly(context);await page.goto('/demo/structure-learning.html');
 await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
 const fixtures=[0,1,2].map(round=>mobileFixture({round,identity:'isin'}));
 const swapped=mobileFixture({round:2,identity:'isin'});
 for(const o of swapped.oracle){const i=swapped.drawing.findIndex(l=>l.text===o.name);[swapped.drawing[i].text,swapped.drawing[i-1].text]=[swapped.drawing[i-1].text,swapped.drawing[i].text];}
 fixtures.push(swapped);
 const pictures=[];for(const f of fixtures)pictures.push((await image(page,f)).toString('base64'));
 const metrics=await page.evaluate(async({pictures,fixtures})=>{
  const {createStructureLearner}=await import('/src/structure-learning.mjs');
  const {resolveMobileCards,documentKey}=await import('/src/mobile-card-holdings.mjs');
  const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
  const w=await Tesseract.createWorker('eng',1,{workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',corePath:location.origin+'/demo/vendor/ocr/core',langPath:location.origin+'/demo/vendor/ocr/lang',gzip:false,workerBlobURL:false,cacheMethod:'none'});
  const sources=[];
  try{for(let i=0;i<pictures.length;i++){
   const result=await w.recognize('data:image/png;base64,'+pictures[i],{}, {tsv:true,text:true});
   sources.push(evidenceFromOcrTsv(result.data.tsv,{imageWidth:fixtures[i].width,imageHeight:fixtures[i].height}));
  }}finally{await w.terminate();}
  const results=[];
  for(const entity of [1,0]){
   const l=createStructureLearner();
   for(let i=0;i<2;i++){
    const card=resolveMobileCards(sources[i],l).cards.find(c=>c.teachable);
    if(!card)throw Error('No readable training card');
    l.confirm({pattern:card.pattern,binding:{entity,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')},documentKey:await documentKey(sources[i]),confirmed:true});
   }
   const s=sources[entity===1?3:2],before=JSON.stringify(l.export()),r=resolveMobileCards(s,l);
   results.push({scenario:entity===1?'swapped':'wrong-teaching',names:r.rows.map(x=>x.fields.name.value),blocked:r.unresolved.map(x=>x.reason),unchanged:before===JSON.stringify(l.export()),canPersist:r.canPersist});
  }
  return results;
 },{pictures,fixtures});
 console.log('P0_REAL_OCR_ATTACKS '+JSON.stringify(metrics));
 for(const r of metrics){expect(r.names).toEqual([]);expect(r.blocked.length).toBeGreaterThan(0);expect(r.unchanged).toBe(true);expect(r.canPersist).toBe(false);}
 expect(outside).toEqual([]);
});

test('P0 real OCR: labelled new instruments and per-document name corrections remain usable',async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=await localOnly(context);await page.goto('/demo/structure-learning.html');
 await page.locator('#language').evaluate(e=>e.closest('details').open=true);await page.locator('#language').selectOption('eng');
 const fixture=mobileFixture({round:2,identity:'isin'});
 const upload=async f=>{await page.locator('#image').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:await image(page,f)});await expect(page.locator('#message')).toContainText('Lähde-ehdotukset valmiit',{timeout:60000});};
 const labelled=structuredClone(fixture);
 labelled.drawing.forEach(l=>{if(labelled.oracle.some(o=>o.name===l.text))l.text='Instrument name: '+l.text;});
 await upload(labelled);
 const labelledNames=await page.locator('#rows article p:first-child').allTextContents();
 console.log('P0_REAL_OCR_LABELLED '+JSON.stringify({correct:labelledNames.filter(n=>fixture.oracle.some(o=>o.name===n)).length,wrong:labelledNames.filter(n=>!fixture.oracle.some(o=>o.name===n)).length}));
 expect(labelledNames).toEqual(fixture.oracle.map(o=>o.name));
 await page.locator('#correction').evaluate(e=>e.open=true);
 const labelledOption=page.locator('#correctionLine option').filter({hasText:'Instrument name: '+fixture.oracle[0].name}).first();
 await page.locator('#correctionLine').selectOption(await labelledOption.getAttribute('value'));
 await expect(page.locator('#correctionValue')).toHaveValue(fixture.oracle[0].name);
 await upload(fixture);await expect(page.locator('#rows article')).toHaveCount(0);
 await expect(page.locator('#reason')).toContainText('Nimi jäi epävarmaksi');
 await page.locator('#correction').evaluate(e=>e.open=true);
 for(const o of fixture.oracle){
  const option=page.locator('#correctionLine option').filter({hasText:o.name}).first();
  await page.locator('#correctionLine').selectOption(await option.getAttribute('value'));
  await page.locator('#correctionField').selectOption('name');await page.locator('#correctionValue').fill(o.name);
  await page.locator('#confirmCorrection').click();
  await expect(page.locator('#originalText')).toContainText(o.name);
 }
 expect(await page.locator('#rows article p:first-child').allTextContents()).toEqual(fixture.oracle.map(o=>o.name));
 await info.attach('p0-local-name-correction',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.locator('#undoCorrection').click();await expect(page.locator('#rows article')).toHaveCount(2);
 await page.locator('#cancel').click();await expect(page.locator('#originalText')).toHaveText('');
 await upload(fixture);await expect(page.locator('#rows article')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('import-engine:structure-learning:v1'))).toBeNull();
 expect(outside).toEqual([]);
 console.log('P0_REAL_OCR_REVIEW '+JSON.stringify({correct:3,wrong:0,confirmedNameFields:3,nextImportBlocked:3,externalRequests:outside.length}));
});

test('P0 original held-out 12 sources: name review and unchanged identity gates',async({page,context})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=await localOnly(context),measurements=[];
 for(const identity of ['ticker','isin'])for(const layout of ['en','fi']){
  await page.goto('/demo/structure-learning.html');await page.locator('#language').evaluate(e=>e.closest('details').open=true);
  await page.locator('#language').selectOption(layout==='en'?'eng':'fin+eng');
  const f=mobileFixture({layout,identity,round:2});
  await page.locator('#image').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:await image(page,f)});
  await expect(page.locator('#message')).toContainText('Lähde-ehdotukset valmiit',{timeout:60000});
  const before=await page.locator('#rows article').count();
  await page.locator('#correction').evaluate(e=>e.open=true);
  const edit=async(text,field,value)=>{
   const option=page.locator('#correctionLine option').filter({hasText:text}).first();
   await page.locator('#correctionLine').selectOption(await option.getAttribute('value'));
   await page.locator('#correctionField').selectOption(field);await page.locator('#correctionValue').fill(value);await page.locator('#confirmCorrection').click();
  };
  for(const o of f.oracle)await edit(o.name,'name',o.name);
  const afterNames=await page.locator('#rows article').count();
  const ids=identity==='ticker'?(layout==='fi'?f.oracle:f.oracle.slice(0,1)):[];
  for(const o of ids)await edit('Ticker: '+(layout==='fi'?o.ticker.replace(/^Q/,'O'):o.ticker)+' MIC:','identity',`Ticker: ${o.ticker} MIC: ${layout==='fi'?'XHEL':'XNAS'}`);
  const actual=await page.locator('#rows article').evaluateAll(cards=>cards.map(c=>[...c.querySelectorAll('p')].map(p=>p.textContent)));
  const correct=f.oracle.filter(o=>actual.some(r=>r[0]===o.name&&r[1]===`${o.qty} kpl · ${o.isin??o.ticker+' / '+(layout==='fi'?'XHEL':'XNAS')}`)).length;
  measurements.push({layout,identity,before,afterNames,correct,wrong:actual.length-correct,confirmedNameFields:3,confirmedIdentityFields:ids.length});
 }
 console.log('P0_ORIGINAL_12_REVIEW '+JSON.stringify({measurements,externalRequests:outside.length}));
 for(const m of measurements){expect(m.before).toBe(0);expect(m.correct).toBe(3);expect(m.wrong).toBe(0);}
 expect(outside).toEqual([]);
});
