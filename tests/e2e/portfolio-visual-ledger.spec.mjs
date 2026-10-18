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
    const {suggestInstrumentListings,selectInstrumentListing}=
      await import('/src/portfolio-instrument-listings.mjs');
    const received=[];
    const listings=await suggestInstrumentListings(result,{lookupMode:'local',
      resolver:async ({name})=>{
        received.push(name);
        const index=f.oracle.findIndex(o=>o.name===name);
        const matched=index>=0?f.oracle[index]:null;
        const type=matched?.kind==='fund'?'MUTUALFUND':'EQUITY';
        const stock=index===1;
        const common={shortname:name,longname:name,quote_type:type,
          exchange:'XHEL',currency:'USD'};
        const candidates=matched?[{...common,symbol:'DEMO'+index+'.XH'}]:[];
        if(stock)candidates.push({...common,symbol:'DEMO'+index+'.XN',exchange:'XNAS'});
        return {schema_version:'instrument-resolver-v1',query:name,candidates};
      }});
    const ambiguous=listings.rows.find(r=>r.status==='ambiguous');
    const choice=ambiguous?selectInstrumentListing(ambiguous,{symbol:ambiguous.matches[0].symbol,exchange:ambiguous.matches[0].exchange}):null;
    return {
      candidates:result.candidates.map(c=>({kind:c.kind,name:c.fields.name.value,
        qty:c.fields.quantity.value,cents:c.fields.marketValue.value?.cents??null,
        sourceIds:c.fields.name.sourceIds})),
      unresolved:result.unresolved.map(u=>u.reason),
      reconciliation:result.reconciliation.status,
      listings:listings.rows.map(r=>({kind:r.kind,name:r.name,status:r.status,
        symbols:r.matches.map(m=>m.symbol),marketVerified:r.marketVerified,canPersist:r.canPersist})),
      listingQueries:received,
      choice:{status:choice?.status??null,canPersist:choice?.canPersist??false,
        marketVerified:choice?.marketVerified??false},
      canPersist:result.canPersist
    };
  },fixture);
}
for(const {crop,shift} of [{crop:false,shift:0},{crop:true,shift:0},{crop:false,shift:-95},{crop:false,shift:-145}])test('genuine OCR + visual holdings on '+(crop?'cropped':'full-screen')+' synthetic portfolio, column '+shift,async({page,context})=>{
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
 for(const line of fixture.drawing)if(line.x>=500)line.x+=shift;
 const got=await run(page,fixture);
 const correct=got.candidates.filter(c=>fixture.oracle.some(o=>o.name===c.name&&
   o.qty===c.qty&&o.cents===c.cents&&o.kind===c.kind)).length;
 const wrong=got.candidates.length-correct;
 console.log('FULLSCREEN_OCR_PORTFOLIO '+JSON.stringify({crop,shift,
   correct,wrong,total:fixture.oracle.length,withheld:fixture.oracle.length-got.candidates.length,
   reconciliation:got.reconciliation,externalRequests:outside.length,
   actual:got.candidates.map(c=>({kind:c.kind,name:c.name,qty:c.qty,cents:c.cents}))}));
 expect(outside).toEqual([]);
 expect(got.canPersist).toBe(false);
 expect(wrong).toBe(0);
 expect(correct).toBeGreaterThanOrEqual(4);
 expect(got.listings).toHaveLength(got.candidates.length);
 expect(got.listingQueries).toEqual(got.candidates.map(c=>c.name));
 expect(got.listings.every(r=>r.status==='suggested'||r.status==='ambiguous')).toBe(true);
 expect(got.listings.every(r=>!r.marketVerified&&!r.canPersist)).toBe(true);
 expect(got.listings.some(r=>r.kind==='fund'&&r.status==='suggested')).toBe(true);
 expect(got.choice).toEqual({status:'user-selected-listing',canPersist:false,marketVerified:false});
});
