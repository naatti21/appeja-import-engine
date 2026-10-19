import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {fundBindingFixture} from '../fixtures/fund-binding.mjs';
for(const staggered of [true,false])test(`Work P1-64-01 real PNG mobile ${staggered?'staggered attack':'aligned control'}`,async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local Tesseract assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{if(!['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:360,height:780});await page.goto('/demo/fund-snapshot-review.html');
 await page.evaluate(async()=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs');const {recognizeLocalPortfolioImage}=await import('/demo/portfolio-identity-review.mjs');mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async(...a)=>{const r=await recognizeLocalPortfolioImage(...a);window.readings=r;return r;}});});
 const png=Buffer.from(await page.evaluate(f=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';for(const d of f.drawing){x.font=d.size+'px Arial';x.fillText(d.text,d.x,d.y);}return c.toDataURL().split(',')[1];},fundBindingFixture(staggered)),'base64');
 await writeFile(info.outputPath('fictional-work-oracle.png'),png);
 await page.locator('#fundFile').setInputFiles({name:'fictional-work.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();
 await expect(page.locator('article')).toHaveCount(1,{timeout:120000});
 const evidence=await page.evaluate(async()=>{const {extractFundSnapshot}=await import('/src/fund-snapshots.mjs');return {...window.readings,result:extractFundSnapshot(window.readings.primary,window.readings.witness)};});
 await writeFile(info.outputPath('two-read-evidence.json'),JSON.stringify(evidence,null,2));
 const row=evidence.result.rows[0];expect(row.fields.name.raw).toBe('Cedar Valley Index');expect(row.fields.quantity.decimal).toBe('37.6');expect(row.fields.value.decimal).toBe('1962.14');expect(row.fields.nav.decimal).toBe('52.1846');
 expect(row.fields.averageAcquisitionPrice.status).toBe('missing');expect(row.canRequestCostBasis).toBe(true);
 await expect(page.getByRole('button',{name:'Täydennä',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Myöhemmin',exact:true})).toBeVisible();
 expect(evidence.result.canPersist).toBe(false);expect(evidence.result.candidates).toEqual([]);expect(evidence.result.actions).toEqual([]);expect(outside).toEqual([]);
});
