import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {issue55Fixture} from '../fixtures/issue55-name-role.mjs';

/**
 * Full real synthetic-pixel route. Never mock the OCR engine or source reader.
 * The only data is a completely invented three-instrument portfolio.
 */
for(const mode of ['clean','faint','absent']) {
  test('P0 issue55 real PNG to dual Tesseract semantic-name '+mode,async({page,context},info)=>{
    test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR models');
    test.setTimeout(240000);
    const outside=[];
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(!['localhost','127.0.0.1'].includes(url.hostname)) {
        outside.push(url.origin);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto('/demo/structure-learning.html');
    await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
    const fixture=issue55Fixture({mode});
    const evidence=await page.evaluate(async f=>{
      const canvas=document.createElement('canvas');
      canvas.width=f.width;canvas.height=f.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.fillStyle='white';ctx.fillRect(0,0,f.width,f.height);
      ctx.font='24px Arial';
      for(const line of f.drawing) {
        ctx.fillStyle=line.color;
        ctx.fillText(line.text,line.x,line.y);
      }
      const png=canvas.toDataURL('image/png');
      const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
      const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
      const worker=await Tesseract.createWorker('fin+eng',1,{
        workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
        corePath:location.origin+'/demo/vendor/ocr/core',
        langPath:location.origin+'/demo/vendor/ocr/lang',
        gzip:false,workerBlobURL:false,cacheMethod:'none'
      });
      let a,b;
      try {
        a=(await worker.recognize(png,{}, {tsv:true,text:true})).data;
        await worker.reinitialize('eng');
        b=(await worker.recognize(png,{}, {tsv:true,text:true})).data;
      } finally { await worker.terminate(); }
      const primary=evidenceFromOcrTsv(a.tsv,{imageWidth:f.width,imageHeight:f.height});
      const witness=evidenceFromOcrTsv(b.tsv,{imageWidth:f.width,imageHeight:f.height});
      return {png,primary,witness,primaryText:a.text,witnessText:b.text,
        result:extractVisualPortfolioCorroborated(primary,witness)};
    },fixture);
    await writeFile(info.outputPath('issue55.png'),
      Buffer.from(evidence.png.split(',')[1],'base64'));
    await writeFile(info.outputPath('evidence.json'),JSON.stringify({
      mode,oracle:fixture.oracle,primaryText:evidence.primaryText,witnessText:evidence.witnessText,
      primary:evidence.primary,witness:evidence.witness,result:evidence.result
    },null,2));
    await info.attach('fictional-issue55.png',{
      path:info.outputPath('issue55.png'),contentType:'image/png'
    });
    await info.attach('dual-ocr-source-evidence.json',{
      path:info.outputPath('evidence.json'),contentType:'application/json'
    });
    const r=evidence.result;
    const correct=r.candidates.filter(c=>fixture.oracle.some(o=>
      c.fields.name.value===o.name&&c.fields.quantity.value===o.quantity&&
      c.fields.marketValue.value?.cents===o.cents)).length;
    const wrong=r.candidates.length-correct,withheld=fixture.oracle.length-correct;
    console.log('ISSUE55_REAL_OCR '+JSON.stringify({
      mode,correct,wrong,withheld,reviewBurden:r.unresolved.length,
      names:r.candidates.map(c=>c.fields.name.value),
      reconciliation:r.reconciliation.status,
      primaryOCR:evidence.primaryText,witnessOCR:evidence.witnessText
    }));
    expect(outside).toEqual([]);
    expect(r.canPersist).toBe(false);
    if(mode!=='clean') {
      // If the real OCR didn't see the heading, this isn't a reproduction.
      expect(/Growth\s+bucket/iu.test(evidence.primaryText)||
        /Growth\s+bucket/iu.test(evidence.witnessText)).toBe(true);
    }
    expect(wrong,'No text with unproven instrument-name role may be proposed').toBe(0);
    expect(correct).toBe(mode==='clean'?3:2);
    expect(r.reconciliation.status).toBe(mode==='clean'?'pass':'not-evaluable');
    if(mode!=='clean') {
      expect(r.unresolved.some(u=>u.field==='name'&&u.sourceIds?.length)).toBe(true);
    }
  });
}
