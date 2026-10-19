import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {economicRoleFixture} from '../fixtures/fund-economic-roles.mjs';
for(const mode of ['unknown-context','above-name','dated-nav','plain-nav','separate-date','dated-gav','day-change','generic-price','conflicting','unlabelled-value','return-near-value'])test('P1-65-01 real PNG role '+mode,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local Tesseract assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:360,height:780});await page.goto('/demo/fund-snapshot-review.html');
 await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs'),{recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async(...args)=>{const readings=await recognizeLocalPortfolioImage(...args);window.roleReadings=readings;return readings;}});});
 const fixture=economicRoleFixture(mode);
 const png=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},fixture),'base64');
 await writeFile(info.outputPath('fictional-source.png'),png);
 await page.locator('#fundFile').setInputFiles({name:'fictional-role.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('#readFunds')).toBeEnabled({timeout:120000});
 const evidence=await page.evaluate(async()=>{const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');const r=window.roleReadings;return {...r,result:extractFundSnapshot(r.primary,r.witness)};});
 await writeFile(info.outputPath('evidence.json'),JSON.stringify(evidence,null,2));await page.screenshot({path:info.outputPath('review.png'),fullPage:true});
 const rows=evidence.result.rows,observedValues=rows.filter(r=>r.fields.value.status==='observed');
 const metrics={mode,sha256:createHash('sha256').update(png).digest('hex'),rows:rows.length,observedValues:observedValues.length,falseValuePromotions:fixture.expectValue?observedValues.filter(r=>r.fields.value.decimal!=='52.1846').length:observedValues.length,withheldValues:rows.filter(r=>r.fields.value.status!=='observed').length};
 await writeFile(info.outputPath('metrics.json'),JSON.stringify(metrics));console.log('ECONOMIC_ROLES '+JSON.stringify(metrics));
 expect(evidence.primary.observations.some(o=>o.raw.includes('52,1846'))).toBe(true);expect(evidence.witness.observations.some(o=>o.raw.includes('52,1846'))).toBe(true);
 expect(evidence.result.canPersist).toBe(false);expect(evidence.result.candidates).toEqual([]);expect(evidence.result.actions).toEqual([]);expect(outside).toEqual([]);
 if(fixture.expectValue){expect(rows).toHaveLength(1);expect(observedValues).toHaveLength(1);expect(rows[0].fields.value.decimal).toBe('52.1846');expect(rows[0].fields.quantity.decimal).toBe('37.6');await expect(page.locator('dd').nth(1)).toHaveText('52,1846 EUR');}
 else{expect(metrics.falseValuePromotions).toBe(0);for(const row of rows){expect(row.structuralStatus).toBe('UNRESOLVED');expect(row.canRequestCostBasis).toBe(false);}if(rows.length)await expect(page.locator('dd').nth(1)).not.toHaveText('52,1846 EUR');}
});
test('P1-65-01 real PNG dated price labels in exchanged columns',async({page},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local Tesseract assets');test.setTimeout(180000);
 const {brokerFundFixture}=await import('../fixtures/fund-broker-structures.mjs');const f=brokerFundFixture('cards');for(const d of f.drawing){if(d.text==='NAV')d.text='Keskikurssi 16.10.2026';else if(d.text==='Keskikurssi')d.text='NAV 16.10.2026';}
 await page.goto('/demo/fund-snapshot-review.html');await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs'),{recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async(...args)=>{const r=await recognizeLocalPortfolioImage(...args);window.roleReadings=r;return r;}});});
 const png=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},f),'base64');await writeFile(info.outputPath('fictional-source.png'),png);
 await page.locator('#fundFile').setInputFiles({name:'fictional-columns.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('#readFunds')).toBeEnabled({timeout:120000});
 const data=await page.evaluate(async()=>{const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');const r=window.roleReadings;return {...r,result:extractFundSnapshot(r.primary,r.witness)};});await writeFile(info.outputPath('evidence.json'),JSON.stringify(data,null,2));await page.screenshot({path:info.outputPath('review.png'),fullPage:true});
 expect(data.result.rows).toHaveLength(5);for(const [i,row] of data.result.rows.entries()){expect(row.fields.value.decimal).toBe(f.oracle[i].value);expect(row.fields.nav.decimal).toBe(f.oracle[i].averageAcquisitionPrice);expect(row.fields.averageAcquisitionPrice.decimal).toBe(f.oracle[i].nav);await expect(page.locator('article').nth(i).locator('dd').nth(2)).toHaveText(f.oracle[i].averageAcquisitionPrice.replace('.',',')+' EUR');}
 expect(data.result.canPersist).toBe(false);expect(data.result.candidates).toEqual([]);expect(data.result.actions).toEqual([]);
});
