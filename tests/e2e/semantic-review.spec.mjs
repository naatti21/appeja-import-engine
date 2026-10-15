import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import '../../research/browser-review-v1/stage-pdf.mjs';
import {reviewPdf} from '../../research/semantic-review-v1/example-pdf.mjs';
const path='/research/semantic-review-v1/';
async function upload(page,lines){await page.locator('#file').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(reviewPdf([{lines}]))});await page.locator('#import').click();await expect(page.locator('#result')).toBeVisible();}
for(const width of [1280,360])test(`semantic browser: real PDF review and original sources at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175/'))requests.push(r.url());});
 await page.goto(path);await upload(page,['Document ID: DEV-Z91','Page 1 of 1','Gross pay 3840.00 EUR','Page 1 of 1 92.00 EUR']);
 await expect(page.locator('#information article')).toHaveCount(2);await expect(page.locator('#actionable article')).toHaveCount(2);
 await expect(page.locator('#actionable')).toContainText('92.00 EUR');
 const card=page.locator('#actionable article').first(),id=await card.getAttribute('data-source-id');
 await card.getByRole('button').click();await expect(page.locator('#preview')).toBeVisible();await expect(page.locator('#sourceText')).toContainText(id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
 expect(requests).toEqual([]);expect(errors).toEqual([]);
 mkdirSync('test-results/semantic-screenshots',{recursive:true});await page.screenshot({path:`test-results/semantic-screenshots/pdf-${width}.png`,fullPage:true});
 await page.locator('#clear').click();await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#source')).toBeHidden();await page.reload();await expect(page.locator('#result')).toBeHidden();
});
test('semantic browser: information-only document, unknown text, malformed file and recovery',async({page})=>{
 await page.goto(path);await upload(page,['Page 1 of 1','Document ID: DEV-W81']);await expect(page.locator('#status')).toContainText('Vain informatiivisia');
 await upload(page,['Page 1 of 1','Unexpected adjustment']);await expect(page.locator('#actionable article')).toHaveCount(1);
 await page.locator('#file').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});await page.locator('#import').click();await expect(page.locator('#error')).toContainText('Tuonti keskeytyi');await expect(page.locator('#result')).toBeHidden();
 await page.locator('#example').click();await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#actionable')).toContainText('3150,00 EUR');
});
test('semantic browser: conflicting metadata and literal HTML remain visible',async({page})=>{
 await page.goto(path);await upload(page,['Document ID: DEV-A21','Document ID: DEV-B22','<img src=x onerror=alert(1)>']);
 await expect(page.locator('#information article')).toHaveCount(0);await expect(page.locator('#actionable article')).toHaveCount(3);await expect(page.locator('#actionable img')).toHaveCount(0);
});
