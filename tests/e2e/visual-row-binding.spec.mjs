import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {rowBindingFixture} from '../fixtures/visual-row-binding.mjs';
for(const attack of [true,false])test('issue49 PNG OCR row role '+(attack?'attack':'control'),async({page,context},info)=>{
 test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');test.setTimeout(240000);
 const outside=[];await context.route('**/*',r=>{
  if(!['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)){outside.push(r.request().url());return r.abort();}
  return r.continue();
 });
 await page.goto('/demo/structure-learning.html');await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
 const f=rowBindingFixture({attack});
 const result=await page.evaluate(async f=>{
  const canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,f.width,f.height);ctx.fillStyle='black';ctx.font='24px Arial';
  for(const l of f.drawing)ctx.fillText(l.text,l.x,l.y);
  const png=canvas.toDataURL('image/png');
  const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
  const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
  const w=await Tesseract.createWorker('fin+eng',1,{workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',corePath:location.origin+'/demo/vendor/ocr/core',langPath:location.origin+'/demo/vendor/ocr/lang',gzip:false,workerBlobURL:false,cacheMethod:'none'});
  let a,b;
  try{a=(await w.recognize(png,{}, {tsv:true,text:true})).data;await w.reinitialize('eng');b=(await w.recognize(png,{}, {tsv:true,text:true})).data;}finally{await w.terminate();}
  const primary=evidenceFromOcrTsv(a.tsv,{imageWidth:f.width,imageHeight:f.height}),witness=evidenceFromOcrTsv(b.tsv,{imageWidth:f.width,imageHeight:f.height});
  return {png,primary,witness,result:extractVisualPortfolioCorroborated(primary,witness)};
 },f);
 await writeFile(info.outputPath('evidence.json'),JSON.stringify({primary:result.primary,witness:result.witness,result:result.result}));
 await writeFile(info.outputPath('synthetic.png'),Buffer.from(result.png.split(',')[1],'base64'));
 await info.attach('synthetic.png',{path:info.outputPath('synthetic.png'),contentType:'image/png'});
 await info.attach('source-evidence.json',{body:JSON.stringify({primary:result.primary,witness:result.witness,result:result.result}),contentType:'application/json'});
 const r=result.result;
 const correct=r.candidates.filter(c=>f.oracle.some(o=>o.name===c.fields.name.value&&o.quantity===c.fields.quantity.value&&o.cents===c.fields.marketValue.value?.cents)).length;
 const wrong=r.candidates.length-correct;
 console.log('ISSUE49_REAL_OCR '+JSON.stringify({attack,correct,wrong,withheld:f.oracle.length-r.candidates.length,names:r.candidates.map(c=>c.fields.name.value),reconciliation:r.reconciliation.status}));
 expect(outside).toEqual([]);expect(wrong).toBe(0);expect(correct).toBe(attack?1:4);
 expect(r.unresolved).toHaveLength(attack?3:0);expect(r.canPersist).toBe(false);
});
