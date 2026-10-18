import {test,expect} from '@playwright/test';
import {inlineLedgerFixture} from '../fixtures/portfolio-inline-ledger.mjs';

// End-to-end synthetic image, no user screenshot, no external market resolver.
// Uses the exact same local Tesseract assets as prior portfolio browser QA.
for(const noSummary of [false,true])test(
  'true OCR compact same-line holdings '+(noSummary?'without':'with')+' totals',
  async ({page,context})=>{
    test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');
    test.setTimeout(240000);
    const outside=[];
    await context.route('**/*',route=>{
      const host=new URL(route.request().url()).hostname;
      if(!['127.0.0.1','localhost'].includes(host)){
        outside.push(host);return route.abort();
      }
      return route.continue();
    });
    await page.goto('/demo/structure-learning.html');
    await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
    const fixture=inlineLedgerFixture({noSummary});
    const result=await page.evaluate(async f=>{
      const canvas=document.createElement('canvas');
      canvas.width=f.width;canvas.height=f.height;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='white';ctx.fillRect(0,0,f.width,f.height);
      ctx.fillStyle='black';ctx.font='24px Arial';
      for(const entry of f.drawing)ctx.fillText(entry.text,entry.x,entry.y);
      const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
      const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
      const worker=await window.Tesseract.createWorker('fin+eng',1,{
        workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
        corePath:location.origin+'/demo/vendor/ocr/core',
        langPath:location.origin+'/demo/vendor/ocr/lang',
        gzip:false,workerBlobURL:false,cacheMethod:'none'
      });
      let primary,witness;
      try{
        const a=await worker.recognize(canvas,{}, {tsv:true,text:true});
        primary=evidenceFromOcrTsv(a.data.tsv,{imageWidth:f.width,imageHeight:f.height});
        await worker.reinitialize('eng');
        const b=await worker.recognize(canvas,{}, {tsv:true,text:true});
        witness=evidenceFromOcrTsv(b.data.tsv,{imageWidth:f.width,imageHeight:f.height});
      }finally{await worker.terminate();}
      const r=extractVisualPortfolioCorroborated(primary,witness);
      return {rows:r.candidates.map(c=>({
        name:c.fields.name.value,kind:c.kind,quantity:c.fields.quantity.value,
        cents:c.fields.marketValue.value?.cents??null,
        canPersist:c.canPersist
      })),unresolved:r.unresolved.map(x=>x.reason),
        reconciliation:r.reconciliation.status,canPersist:r.canPersist};
    },fixture);
    const correct=result.rows.filter(row=>fixture.oracle.some(o=>
      o.name===row.name&&o.kind===row.kind&&o.quantity===row.quantity&&o.cents===row.cents)).length;
    const wrong=result.rows.length-correct;
    console.log('INLINE_TRUE_OCR '+JSON.stringify({noSummary,correct,wrong,
      withheld:fixture.oracle.length-result.rows.length,
      total:fixture.oracle.length,reconciliation:result.reconciliation,
      unresolved:result.unresolved}));
    expect(outside).toEqual([]);
    expect(result.canPersist).toBe(false);
    expect(result.rows.every(r=>r.canPersist===false)).toBe(true);
    expect(wrong).toBe(0);
    expect(correct).toBeGreaterThanOrEqual(2);
  });
