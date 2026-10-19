import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {fundSnapshotFixture,fundDetailFixture} from '../fixtures/fund-snapshots.mjs';
for(const layout of ['compact','cards'])test('issue63 real PNG two local OCR reads '+layout,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');test.setTimeout(240000);
 const outside=[];await context.route('**/*',r=>{if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto('/demo/portfolio-identity-review.html');
 const f=fundSnapshotFixture(layout);
 const result=await page.evaluate(async f=>{
  const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';
  for(const d of f.drawing){ctx.font=d.size+'px Arial';ctx.fillText(d.text,d.x,d.y);}
  const blob=await new Promise(r=>c.toBlob(r));
  const {recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');
  const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');
  const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
  const {primary,witness}=await recognizeLocalPortfolioImage(blob,{signal:new AbortController().signal,width:c.width,height:c.height});
  return {png:c.toDataURL().split(',')[1],primary,witness,snapshot:extractFundSnapshot(primary,witness),baseline:extractVisualPortfolioCorroborated(primary,witness)};
 },f);
 const png=Buffer.from(result.png,'base64');await writeFile(info.outputPath('fictional.png'),png);delete result.png;
 await writeFile(info.outputPath('evidence.json'),JSON.stringify(result,null,2));
 await info.attach('evidence',{path:info.outputPath('evidence.json'),contentType:'application/json'});
 const comparisons=f.oracle.flatMap((expected,i)=>['quantity','value','nav','averageAcquisitionPrice'].filter(k=>expected[k]!==null).map(k=>({field:k,correct:result.snapshot.rows[i]?.fields[k].status==='observed'&&result.snapshot.rows[i]?.fields[k].decimal===expected[k]})));
 const metrics={layout,expectedRows:f.oracle.length,correctNameObservations:result.snapshot.rows.filter((r,i)=>r.fields.name.raw===f.oracle[i]?.name).length,withheldRows:f.oracle.length-result.snapshot.rows.filter(r=>r.structuralStatus==='OBSERVED_ROW_REQUIRES_IDENTITY_REVIEW').length,correctNumericalFields:comparisons.filter(c=>c.correct).length,incorrectOrWithheldNumericalFields:comparisons.filter(c=>!c.correct).length,missingCostBasis:result.snapshot.rows.filter(r=>r.fields.averageAcquisitionPrice.status==='missing').length,costBasisQuestions:result.snapshot.rows.filter(r=>r.canRequestCostBasis).length,baselineCandidates:result.baseline.candidates.length,automaticInstrumentPromotions:result.snapshot.candidates.length,verifiedInstruments:result.snapshot.marketIdentityVerified?result.snapshot.rows.length:0};
 await writeFile(info.outputPath('metrics.json'),JSON.stringify(metrics,null,2));console.log('FUND_OCR '+JSON.stringify(metrics));
 expect(result.snapshot.rows).toHaveLength(f.oracle.length);
 for(const [i,row] of result.snapshot.rows.entries()){
  expect(row.fields.name.raw).toBe(f.oracle[i].name);
  for(const key of ['quantity','value','nav','averageAcquisitionPrice']){expect(row.fields[key].status,key).toBe(f.oracle[i][key]===null?'missing':'observed');expect(row.fields[key].decimal,key).toBe(f.oracle[i][key]);}
 }
 expect(result.snapshot.candidates).toEqual([]);
 for(const width of [320,360,393]){
  await page.setViewportSize({width,height:800});await page.goto('/demo/fund-snapshot-review.html');
  await page.locator('#fundFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();
  await expect(page.locator('article')).toHaveCount(f.oracle.length,{timeout:120000});
  for(const [i,row] of f.oracle.entries())await expect(page.locator('article').nth(i).locator('h2')).toHaveText(row.name);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('button:visible').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().height>=44))).toBe(true);
  if(layout==='compact'){
   await expect(page.getByText('Keskihankintahinta puuttuu tästä kuvasta.',{exact:false})).toBeVisible();
   await page.getByRole('button',{name:'Myöhemmin',exact:true}).click();await expect(page.getByText('Keskihankintahintaa ei vahvistettu.',{exact:false})).toBeVisible();
   await page.getByRole('button',{name:'Täydennä',exact:true}).click();await page.getByRole('button',{name:'Täydennä',exact:true}).click();
   const detailPng=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},fundDetailFixture()),'base64');
   await page.getByLabel('Erillinen rahaston tietokuva (valinnainen)').setInputFiles({name:'fictional-detail.png',mimeType:'image/png',buffer:detailPng});
   await page.getByRole('button',{name:'Käytä erillisen kuvan hintaa luonnoksessa'}).click({timeout:120000});
   await expect(page.getByLabel('Erikseen tarkistettu keskihankintahinta')).toHaveValue('19.1234');
   await page.getByRole('button',{name:'Vahvista erillinen käyttäjähavainto'}).click();
   await expect(page.getByText('Käyttäjän erillinen havainto: 19.1234.',{exact:false})).toBeVisible();
   await expect(page.locator('dd').last()).toHaveText('Puuttuu kuvasta');
   await page.getByRole('button',{name:'Kumoa täydennys'}).click();
  }else await expect(page.getByRole('button',{name:'Täydennä',exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`review-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();await expect(page.locator('article')).toHaveCount(0);await expect(page.locator('#fundImage')).not.toHaveAttribute('src',/.+/);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
 }
 expect(outside).toEqual([]);
});
for(const attack of ['receipt','percent','heading','swapped-columns'])test('issue63 real PNG adversary '+attack,async({page},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');test.setTimeout(180000);await page.goto('/demo/fund-snapshot-review.html');
 const f=fundSnapshotFixture(attack==='swapped-columns'?'cards':'compact');
 if(attack==='receipt')f.drawing[1].text='Ostokuitti';
 if(attack==='percent')f.drawing.find(d=>d.text==='49,7 kpl').text='49,7 %';
 if(attack==='heading'){f.drawing.find(d=>d.text==='Juniper Horizon Sustainable').text='Growth bucket';f.drawing=f.drawing.filter(d=>d.text!=='Index');}
 if(attack==='swapped-columns')for(const d of f.drawing){if(d.text==='NAV')d.text='Keskihankintahinta';else if(d.text==='Keskihankintahinta')d.text='NAV';}
 const r=await page.evaluate(async f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}const blob=await new Promise(r=>c.toBlob(r));const {recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');const readings=await recognizeLocalPortfolioImage(blob,{signal:new AbortController().signal,width:f.width,height:f.height});return {...readings,result:extractFundSnapshot(readings.primary,readings.witness)};},f);
 await writeFile(info.outputPath('adversary.json'),JSON.stringify(r,null,2));expect(r.result.candidates).toEqual([]);expect(r.result.canPersist).toBe(false);
 if(attack==='receipt'){expect(r.result.documentRole).toBe('UNKNOWN_DOCUMENT_ROLE');expect(r.result.rows).toEqual([]);}
 if(attack==='percent'){expect(r.result.rows[0].fields.quantity.status).toBe('ambiguous');expect(r.result.rows[0].structuralStatus).toBe('UNRESOLVED');}
 if(attack==='heading'){expect(r.result.rows[0].fields.name.raw).toBe('Growth bucket');expect(r.result.rows[0].identityStatus).toBe('UNVERIFIED');}
 if(attack==='swapped-columns')for(const [i,row] of r.result.rows.entries()){expect(row.fields.nav.decimal).toBe(f.oracle[i].averageAcquisitionPrice);expect(row.fields.averageAcquisitionPrice.decimal).toBe(f.oracle[i].nav);}
});
test('issue63 cancelled late OCR cannot restore a review',async({page})=>{
 await page.goto('/demo/fund-snapshot-review.html');await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:()=>new Promise(resolve=>{window.finishFundOcr=resolve;})});});
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=50;c.height=50;return c.toDataURL().split(',')[1];}),'base64');
 await page.locator('#fundFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof window.finishFundOcr)).toBe('function');
 await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();await page.evaluate(f=>window.finishFundOcr({primary:f.source,witness:f.source}),fundSnapshotFixture());await expect(page.locator('article')).toHaveCount(0);await expect(page.locator('#fundImage')).not.toHaveAttribute('src',/.+/);
});
