import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {issue55Fixture} from '../fixtures/issue55-name-role.mjs';

/**
 * Full real synthetic-pixel route. Never mock the OCR engine or source reader.
 * The only data is a completely invented three-instrument portfolio.
 */
for(const mode of ['clean','faint','absent']) {
  test('P0 issue55 gated true PNG dual Tesseract review '+mode,async({page,context},info)=>{
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
      const {preparePortfolioIdentityReview}=await import('/src/portfolio-identity-review.mjs');
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
      const raw=extractVisualPortfolioCorroborated(primary,witness);
      return {png,primary,witness,primaryText:a.text,witnessText:b.text,
        raw,review:preparePortfolioIdentityReview(raw,primary)};
    },fixture);
    await writeFile(info.outputPath('issue55.png'),
      Buffer.from(evidence.png.split(',')[1],'base64'));
    await writeFile(info.outputPath('evidence.json'),JSON.stringify({
      mode,oracle:fixture.oracle,primaryText:evidence.primaryText,witnessText:evidence.witnessText,
      primary:evidence.primary,witness:evidence.witness,raw:evidence.raw,review:evidence.review
    },null,2));
    await info.attach('fictional-issue55.png',{
      path:info.outputPath('issue55.png'),contentType:'image/png'
    });
    await info.attach('dual-ocr-source-evidence.json',{
      path:info.outputPath('evidence.json'),contentType:'application/json'
    });
    const raw=evidence.raw,review=evidence.review;
    const correct=raw.candidates.filter(c=>fixture.oracle.some(o=>
      c.fields.name.value===o.name&&c.fields.quantity.value===o.quantity&&
      c.fields.marketValue.value?.cents===o.cents)).length;
    const falseRaw=raw.candidates.length-correct;
    console.log('ISSUE55_REVIEW_TRUE_OCR '+JSON.stringify({
      mode,rawCorrect:correct,rawFalse:falseRaw,
      rawNames:raw.candidates.map(c=>c.fields.name.value),
      untrustedObservedTexts:review.rows.map(r=>r.observedText),
      reviewBurden:review.rows.length,
      automaticallyPromoted:review.candidates.length,
      rawReconciliation:raw.reconciliation.status,
      safeReconciliation:review.reconciliation.status
    }));
    expect(outside).toEqual([]);
    expect(raw.canPersist).toBe(false);
    expect(review.canPersist).toBe(false);
    expect(review.marketIdentityVerified).toBe(false);
    expect(review.candidates).toHaveLength(0);
    expect(review.userSelections).toHaveLength(0);
    expect(review.rows).toHaveLength(3);
    expect(review.unresolved.filter(u=>u.reason==='UNPROVEN_SEMANTIC_NAME_ROLE')).toHaveLength(3);
    expect(review.reconciliation.status).toBe('not-evaluable');
    expect(review.observedArithmetic).toBe('pass');
    expect(correct).toBe(mode==='clean'?3:2);
    if(mode==='clean') expect(falseRaw).toBe(0);
    else {
      // A genuine OCR failure is expected; the HANDOFF, not OCR, must be safe.
      expect(falseRaw).toBe(1);
      expect(review.rows.some(r=>r.observedText==='Growth bucket')).toBe(true);
      expect(review.rows.every(r=>r.observedTextRole==='UNPROVEN_NAME_OR_HEADING')).toBe(true);
      expect(/Growth\s+bucket/iu.test(evidence.primaryText)&&
        /Growth\s+bucket/iu.test(evidence.witnessText)).toBe(true);
    }
  });
}
