import {test,expect} from '@playwright/test';
import {mobileFixture} from '../fixtures/mobile-cards.mjs';

test('issue45 real OCR: varying headings above a repeated issuer cannot become learned names',async({page,context})=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Requires local OCR assets');test.setTimeout(180000);
 const outside=[];await context.route('**/*',r=>{
  if(new URL(r.request().url()).hostname!=='127.0.0.1'){outside.push(r.request().url());return r.abort();}return r.continue();
 });
 await page.goto('/demo/structure-learning.html');await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
 const fixtures=[0,1,2].map(round=>{
  const f=mobileFixture({round,identity:'isin'}),headings=['Growth sleeve','Income sleeve','Reserve sleeve'];let index=0;
  for(const l of f.drawing){if(l.text==='Research basket')l.text=headings[index++];else if(f.oracle.some(o=>o.name===l.text))l.text='Fictional Shared Issuer';}
  return f;
 });
 const result=await page.evaluate(async fixtures=>{
  const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
  const {resolveMobileCards,documentKey}=await import('/src/mobile-card-holdings.mjs');
  const {createStructureLearner}=await import('/src/structure-learning.mjs');
  const worker=await Tesseract.createWorker('eng',1,{workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',corePath:location.origin+'/demo/vendor/ocr/core',langPath:location.origin+'/demo/vendor/ocr/lang',gzip:false,workerBlobURL:false,cacheMethod:'none'});
  const learner=createStructureLearner();let source;
  try{for(let i=0;i<fixtures.length;i++){
   const f=fixtures[i],c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d');
   x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='24px Arial';for(const l of f.drawing)x.fillText(l.text,l.x,l.y);
   const read=await worker.recognize(c.toDataURL(),{}, {tsv:true,text:true});
   source=evidenceFromOcrTsv(read.data.tsv,{imageWidth:f.width,imageHeight:f.height});
   if(i<2){const card=resolveMobileCards(source,learner).cards.find(c=>c.teachable);if(!card)throw Error('No readable training card');
    learner.confirm({pattern:card.pattern,binding:{entity:0,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')},documentKey:await documentKey(source),confirmed:true});}
  }}finally{await worker.terminate();}
  const before=JSON.stringify(learner.export()),r=resolveMobileCards(source,learner);
  return {names:r.rows.map(x=>x.fields.name.value),blocked:r.unresolved.map(x=>x.reason),canPersist:r.canPersist,profileUnchanged:before===JSON.stringify(learner.export())};
 },fixtures);
 console.log('ISSUE45_REAL_HEADING_ATTACK '+JSON.stringify(result));
 expect(result.names).toEqual([]);expect(result.blocked).toHaveLength(3);expect(result.canPersist).toBe(false);expect(result.profileUnchanged).toBe(true);expect(outside).toEqual([]);
});
