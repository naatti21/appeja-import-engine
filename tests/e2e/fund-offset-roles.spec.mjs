import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {offsetRoleFixture} from '../fixtures/fund-offset-roles.mjs';
for(const mode of ['nav','gav','left-offset','wide-font'])test('Work P1-66-01 actual PNG '+mode,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:360,height:780});await page.goto('/demo/fund-snapshot-review.html');
 await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs'),{recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async(...args)=>{const r=await recognizeLocalPortfolioImage(...args);window.offsetReadings=r;return r;}});});
 const png=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},offsetRoleFixture(mode)),'base64');await writeFile(info.outputPath('source.png'),png);
 await page.locator('#fundFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('#readFunds')).toBeEnabled({timeout:120000});
 const data=await page.evaluate(async()=>{const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');const r=window.offsetReadings;return {...r,result:extractFundSnapshot(r.primary,r.witness)};});await writeFile(info.outputPath('evidence.json'),JSON.stringify(data,null,2));await page.screenshot({path:info.outputPath('review.png'),fullPage:true});
 const falseValues=data.result.rows.filter(r=>r.fields.value.status==='observed').length;await writeFile(info.outputPath('metrics.json'),JSON.stringify({mode,sha256:createHash('sha256').update(png).digest('hex'),rows:data.result.rows.length,falseValues}));
 for(const read of [data.primary,data.witness]){expect(read.observations.some(o=>o.raw.includes(mode==='gav'?'GAV':'NAV'))).toBe(true);expect(read.observations.some(o=>o.raw.includes(mode==='gav'?'61,7254':'73,4826'))).toBe(true);}
 expect(falseValues).toBe(0);for(const row of data.result.rows){expect(row.canRequestCostBasis).toBe(false);expect(row.structuralStatus).toBe('UNRESOLVED');}await expect(page.getByRole('button',{name:'Täydennä',exact:true})).toHaveCount(0);
 expect(data.result.canPersist).toBe(false);expect(data.result.candidates).toEqual([]);expect(data.result.actions).toEqual([]);expect(outside).toEqual([]);
});

import {roleControlFixture} from '../fixtures/fund-role-controls.mjs';
for(const mode of ['one','five','cross-conflict','cross-control'])test('economic role actual PNG control '+mode,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:360,height:780});await page.goto('/demo/fund-snapshot-review.html');
 await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs'),{recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async(...args)=>{const r=await recognizeLocalPortfolioImage(...args);window.controlReadings=r;return r;}});});
 const fixture=roleControlFixture(mode),png=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},fixture),'base64');await writeFile(info.outputPath('source.png'),png);
 await page.locator('#fundFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('#readFunds')).toBeEnabled({timeout:120000});
 const data=await page.evaluate(async()=>{const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');const r=window.controlReadings;return {...r,result:extractFundSnapshot(r.primary,r.witness)};});await writeFile(info.outputPath('evidence.json'),JSON.stringify(data,null,2));await page.screenshot({path:info.outputPath('review.png'),fullPage:true});
 const metrics={mode,sha256:createHash('sha256').update(png).digest('hex'),expected:fixture.oracle.length,correct:0,wrong:0,withheld:0};
 for(const [i,o] of fixture.oracle.entries()){const row=data.result.rows[i];if(row?.fields.value.status==='observed'){if(row.fields.value.decimal===o.value&&!o.withheld)metrics.correct++;else metrics.wrong++;}else metrics.withheld++;}
 await writeFile(info.outputPath('metrics.json'),JSON.stringify(metrics));console.log('ROLE_CONTROL '+JSON.stringify(metrics));
 expect(data.result.rows).toHaveLength(fixture.oracle.length);await expect(page.locator('article')).toHaveCount(fixture.oracle.length);
 for(const [i,o] of fixture.oracle.entries()){
  const row=data.result.rows[i];expect(row.fields.name.raw).toBe(o.name);expect(row.fields.quantity.decimal).toBe(o.quantity);
  if(o.withheld){expect(row.fields.value.status).toBe('ambiguous');expect(row.fields.value.decimal).toBeNull();expect(row.canRequestCostBasis).toBe(false);}
  else{expect(row.fields.value.status).toBe('observed');expect(row.fields.value.decimal).toBe(o.value);expect(row.structuralStatus).toBe('OBSERVED_ROW_REQUIRES_IDENTITY_REVIEW');}
 }
 expect(metrics.wrong).toBe(0);expect(data.result.canPersist).toBe(false);expect(data.result.candidates).toEqual([]);expect(outside).toEqual([]);
});
