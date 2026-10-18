import {test,expect} from '@playwright/test';
import {visualLedgerFixture} from '../fixtures/portfolio-visual-ledger.mjs';

// Genuine synthetic PNG -> actual local Tesseract -> canonical geometry -> adapter.
// No real holdings or snapshots are uploaded, logged, or committed.
async function run(page,fixture) {
  return page.evaluate(async f=>{
    const canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='black';ctx.font='24px Arial';
    for(const line of f.drawing)ctx.fillText(line.text,line.x,line.y);
    const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
    const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
    const w=await window.Tesseract.createWorker('fin+eng',1,{
      workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
      corePath:location.origin+'/demo/vendor/ocr/core',
      langPath:location.origin+'/demo/vendor/ocr/lang',
      gzip:false,workerBlobURL:false,cacheMethod:'none'
    });
    let result;
    try{
      const o=await w.recognize(canvas,{}, {tsv:true,text:true});
      const source=evidenceFromOcrTsv(o.data.tsv,{imageWidth:f.width,imageHeight:f.height});
      await w.reinitialize('eng');
      const e=await w.recognize(canvas,{}, {tsv:true,text:true});
      const witness=evidenceFromOcrTsv(e.data.tsv,{imageWidth:f.width,imageHeight:f.height});
      result=extractVisualPortfolioCorroborated(source,witness);
    }finally{await w.terminate();}
    return {
      candidates:result.candidates.map(c=>({kind:c.kind,name:c.fields.name.value,
        qty:c.fields.quantity.value,cents:c.fields.marketValue.value?.cents??null,
        sourceIds:c.fields.name.sourceIds})),
      unresolved:result.unresolved.map(u=>u.reason),
      reconciliation:result.reconciliation.status,
      canPersist:result.canPersist
    };
  },fixture);
}
for(const crop of [false,true])test('genuine OCR + visual holdings on '+(crop?'cropped':'full-screen')+' synthetic portfolio',async({page,context})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Staged same-origin Tesseract OCR required');
 test.setTimeout(240000);
 const outside=[];await context.route('**/*',route=>{
   const hostname=new URL(route.request().url()).hostname;
   if(!['127.0.0.1','localhost'].includes(hostname)){outside.push(hostname);return route.abort();}
   return route.continue();
 });
 await page.goto('/demo/structure-learning.html');
 await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
 const fixture=visualLedgerFixture({crop});
 const got=await run(page,fixture);
 const correct=got.candidates.filter(c=>fixture.oracle.some(o=>o.name===c.name&&
   o.qty===c.qty&&o.cents===c.cents&&o.kind===c.kind)).length;
 const wrong=got.candidates.length-correct;
 console.log('FULLSCREEN_OCR_PORTFOLIO '+JSON.stringify({crop,
   correct,wrong,total:fixture.oracle.length,withheld:fixture.oracle.length-got.candidates.length,
   reconciliation:got.reconciliation,externalRequests:outside.length,
   actual:got.candidates.map(c=>({kind:c.kind,name:c.name,qty:c.qty,cents:c.cents}))}));
 expect(outside).toEqual([]);
 expect(got.canPersist).toBe(false);
 expect(wrong).toBe(0);
 expect(correct).toBeGreaterThanOrEqual(1);
});
