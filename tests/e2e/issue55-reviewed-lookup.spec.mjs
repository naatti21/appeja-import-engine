import {test,expect} from '@playwright/test';
import {issue55Fixture} from '../fixtures/issue55-name-role.mjs';
test('issue55 true OCR and external lookup never promotes subgroup heading',async({page,context})=>{
  test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');
  test.setTimeout(240000);
  const outside=[];
  await context.route('**/*',r=>{
    if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){
      outside.push(r.request().url());return r.abort();
    }
    return r.continue();
  });
  await page.goto('/demo/structure-learning.html');
  await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
  const fixture=issue55Fixture({mode:'faint'});
  const got=await page.evaluate(async f=>{
    const canvas=document.createElement('canvas');
    canvas.width=f.width;canvas.height=f.height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,f.width,f.height);
    ctx.font='24px Arial';
    for(const line of f.drawing){ctx.fillStyle=line.color;ctx.fillText(line.text,line.x,line.y);}
    const png=canvas.toDataURL('image/png');
    const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
    const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
    const {preparePortfolioIdentityReview,chooseInstrumentIdentity}
      =await import('/src/portfolio-identity-review.mjs');
    const {suggestInstrumentListings}=await import('/src/portfolio-instrument-listings.mjs');
    const worker=await Tesseract.createWorker('fin+eng',1,{
      workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
      corePath:location.origin+'/demo/vendor/ocr/core',
      langPath:location.origin+'/demo/vendor/ocr/lang',gzip:false,
      workerBlobURL:false,cacheMethod:'none'
    });
    let first,second;
    try{
      first=(await worker.recognize(png,{}, {tsv:true,text:true})).data;
      await worker.reinitialize('eng');
      second=(await worker.recognize(png,{}, {tsv:true,text:true})).data;
    }finally{await worker.terminate();}
    const a=evidenceFromOcrTsv(first.tsv,{imageWidth:f.width,imageHeight:f.height});
    const b=evidenceFromOcrTsv(second.tsv,{imageWidth:f.width,imageHeight:f.height});
    const raw=extractVisualPortfolioCorroborated(a,b);
    const calls=[],resolver=async({name})=>{
      calls.push(name);
      return {schema_version:'instrument-resolver-v1',query:name,candidates:[]};
    };
    const args={resolver,lookupMode:'external',approvedExternalLookup:true};
    const bypass=await suggestInstrumentListings(raw,args);
    const review=preparePortfolioIdentityReview(raw,a);
    const before=await suggestInstrumentListings(review,args);
    const problem=review.rows.find(r=>r.observedText==='Growth bucket');
    const chosen=chooseInstrumentIdentity(review,{rowId:problem?.rowId,
      decision:'correct-name',chosenName:'Amber Circuit'});
    const after=await suggestInstrumentListings(chosen,args);
    return {
      rawNames:raw.candidates.map(c=>c.fields.name.value),
      bypass,reviewRows:review.rows.length,before,after,calls,
      reviewCanPersist:review.canPersist,chosenCanPersist:chosen.canPersist
    };
  },fixture);
  console.log('ISSUE55_TRUE_OCR_LOOKUP '+JSON.stringify(got));
  expect(outside).toEqual([]);
  expect(got.rawNames).toContain('Growth bucket');
  expect(got.reviewRows).toBe(3);
  expect(got.bypass.rows).toEqual([]);
  expect(got.bypass.issues).toEqual([{reason:'EXPLICIT_IDENTITY_REVIEW_REQUIRED'}]);
  expect(got.before.rows).toEqual([]);
  expect(got.calls).toEqual(['Amber Circuit']);
  expect(got.after.rows).toHaveLength(1);
  expect(got.after.rows[0].name).toBe('Amber Circuit');
  expect(got.after.canPersist).toBe(false);
  expect(got.reviewCanPersist).toBe(false);
  expect(got.chosenCanPersist).toBe(false);
});
