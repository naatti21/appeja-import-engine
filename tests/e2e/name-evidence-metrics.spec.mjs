import {test,expect} from '@playwright/test';
import {mobileFixture} from '../fixtures/mobile-cards.mjs';
// Do not alter the frozen source/oracle set: actual pixels -> Tesseract -> candidates.
async function upload(page,f){
 const base64=await page.evaluate(f=>{
  const c=document.createElement('canvas');c.width=f.width;c.height=f.height;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='black';ctx.font='24px Arial';
  for(const item of f.drawing)ctx.fillText(item.text,item.x,item.y);
  return c.toDataURL('image/png').split(',')[1];
 },f);
 await page.locator('#image').setInputFiles({
  name:'fictional-card-evidence.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')
 });
 await expect(page.locator('#message')).toContainText('Lähde-ehdotukset valmiit',{timeout:120000});
}
async function teach(page){
 await page.locator('#teaching').evaluate(el=>el.open=true);
 const options=await page.locator('#card option').all();
 for(const item of options){
  await page.locator('#card').selectOption(await item.getAttribute('value'));
  if(!(await page.locator('#teach').isEnabled()))continue;
  await page.locator('#entity').selectOption('1');
  for(const key of ['identity','measure']){
   const value=await page.locator('#'+key+' option').nth(1).getAttribute('value');
   await page.locator('#'+key).selectOption(value);
  }
  await page.locator('#teach').click();
  return;
 }
}
const cases=[
 {layout:'en',identity:'ticker',required:2},
 {layout:'fi',identity:'ticker',required:0},
 {layout:'en',identity:'isin',required:3},
 {layout:'fi',identity:'isin',required:3},
];
for(const scenario of cases)test('locked real-pixel source identity coverage: '+scenario.layout+'/'+scenario.identity,async({page,context})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires true local Tesseract assets');
 test.setTimeout(240000);
 const forbidden=[];await context.route('**/*',r=>{
  const host=new URL(r.request().url()).hostname;
  if(!['127.0.0.1','localhost'].includes(host)){forbidden.push(r.request().url());return r.abort();}
  return r.continue();
 });
 await page.goto('/demo/structure-learning.html');
 if(scenario.layout==='en'){
  await page.locator('#language').evaluate(e=>e.closest('details').open=true);
  await page.locator('#language').selectOption('eng');
 }
 let measurement=null;
 for(let round=0;round<3;round++){
  const fixture=mobileFixture({layout:scenario.layout,round,identity:scenario.identity});
  await upload(page,fixture);
  if(round<2){await teach(page);continue;}
  const rows=await page.locator('#rows article').evaluateAll(nodes=>nodes.map(n=>
   [...n.querySelectorAll('p')].map(p=>p.textContent)));
  const correct=fixture.oracle.filter(o=>rows.some(r=>r[0]===o.name&&
    r[1]===\`\${o.qty} kpl · \${o.isin??(o.ticker+' / '+(scenario.layout==='fi'?'XHEL':'XNAS'))}\`)).length;
  measurement={layout:scenario.layout,identity:scenario.identity,correct,
    wrong:rows.length-correct,unresolved:fixture.oracle.length-rows.length,expected:3,
    fieldCorrectionCount:0,marketVerifiedCount:0};
  }
 console.log('SOURCE_SEMANTIC_12_ROW '+JSON.stringify(measurement));
 expect(forbidden).toEqual([]);
 expect(measurement.wrong).toBe(0);
 expect(measurement.correct).toBe(scenario.required);
});
