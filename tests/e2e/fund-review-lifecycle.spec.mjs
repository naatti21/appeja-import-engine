import {test,expect} from '@playwright/test';
import {brokerFundFixture} from '../fixtures/fund-broker-structures.mjs';
import {fundSnapshotFixture} from '../fixtures/fund-snapshots.mjs';
// These are explicitly controlled OCR lifecycle tests, not real recognition evidence.
async function setup(page){
 await page.goto('/demo/fund-snapshot-review.html');
 const f=brokerFundFixture('cards');f.source.observations=f.source.observations.filter(o=>!f.oracle.some(r=>r.averageAcquisitionPrice.replace('.',',')+' EUR'===o.raw));
 await page.evaluate(async f=>{const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs');window.calls=0;mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:async()=>{window.calls++;return {primary:f.source,witness:structuredClone(f.source)};}});},f);
 const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;return c.toDataURL().split(',')[1];}),'base64');
 await page.locator('#fundFile').setInputFiles({name:'fictional-controlled.png',mimeType:'image/png',buffer:image});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('article')).toHaveCount(5);return image;
}
test('controlled multi-card action preserves another card form and source',async({page})=>{
 await setup(page);const first=page.locator('article').first(),second=page.locator('article').nth(1);await first.getByRole('button',{name:'Täydennä',exact:true}).click();const price=first.getByLabel('Erikseen tarkistettu keskihankintahinta');await expect(price).toBeFocused();await price.fill('31,8752');await first.getByLabel('Mistä tiedosta tarkistit hinnan?').fill('Fiktiivinen lähde');const handle=await price.elementHandle();
 await second.getByRole('button',{name:'Myöhemmin',exact:true}).click();expect(await handle.evaluate(e=>e.isConnected)).toBe(true);await expect(price).toHaveValue('31,8752');await first.getByRole('button',{name:'Vahvista erillinen käyttäjähavainto'}).click();await expect(first).toContainText('31,8752');await expect(first.locator('dd').last()).toHaveText('Puuttuu kuvasta');
});
for(const transition of ['cancel','new-file'])test('controlled late detail OCR after '+transition,async({page})=>{
 const image=await setup(page);await page.evaluate(async f=>{
  const {mountFundSnapshotReview}=await import('/demo/fund-snapshot-review.mjs');let calls=0;window.finishDetail=null;
  mountFundSnapshotReview(document.getElementById('fundReview'),{recognize:()=>{if(++calls===1)return Promise.resolve({primary:f.source,witness:structuredClone(f.source)});return new Promise(resolve=>window.finishDetail=()=>resolve({primary:f.source,witness:structuredClone(f.source)}));}});
 },fundSnapshotFixture());
 await page.locator('#fundFile').setInputFiles({name:'controlled.png',mimeType:'image/png',buffer:image});await page.getByRole('button',{name:'Lue kuva',exact:true}).click();await expect(page.locator('article')).toHaveCount(1);await page.getByRole('button',{name:'Täydennä',exact:true}).click();await page.getByLabel('Erillinen rahaston tietokuva (valinnainen)').setInputFiles({name:'controlled-detail.png',mimeType:'image/png',buffer:image});await expect.poll(()=>page.evaluate(()=>typeof window.finishDetail)).toBe('function');
 if(transition==='cancel')await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();else await page.locator('#fundFile').setInputFiles({name:'new-file.png',mimeType:'image/png',buffer:image});
 await page.evaluate(()=>window.finishDetail());await expect(page.locator('article')).toHaveCount(0);await expect(page.getByRole('button',{name:'Käytä erillisen kuvan hintaa luonnoksessa'})).toHaveCount(0);await expect(page.locator('#readFunds')).toBeEnabled();
});
