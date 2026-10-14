import {test,expect} from '@playwright/test';
import {seeded} from '../qa/generator.mjs';
test.setTimeout(240000);
const NAMES=['ASTERONE','BOREALIS','CALDERA','DENALI','ELMSTONE','FABLE'];
const fmt=n=>n.toFixed(2).replace('.',',');
function cases(){
 const out=[];
 for(const seed of [71,193]){
  const rng=seeded(seed);
  for(let i=0;i<8;i++){
   const qty=2+Math.floor(rng()*16),price=+(5+rng()*36).toFixed(2);
   out.push({seed,index:i,name:NAMES[i%NAMES.length],qty,price,
    value:+(qty*price).toFixed(2),
    width:i<4?1500:i<6?1000:760,font:i<4?42:i<6?32:22,
    dark:i%2===1,jpeg:i>=6,
    class:i<4?'baseline':i<6?'normal':'stress'});
  }
 }
 return out;
}
function score(text,o){
 const clean=text.normalize('NFKC').toUpperCase().replace(/\s+/g,' ');
 const numberToken=n=>new RegExp('(^|[^0-9])'+String(n)+'($|[^0-9])').test(clean);
 const decimalToken=n=>new RegExp('(^|[^0-9])'+n.toFixed(2).replace('.','[,.]')+'($|[^0-9])').test(clean);
 const ticker=clean.includes(o.name),quantity=numberToken(o.qty),
  price=decimalToken(o.price),value=decimalToken(o.value);
 return {ticker,quantity,price,value,all:ticker&&quantity&&price&&value};
}
async function localOnly(context){
 const external=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)){external.push(url.href);return route.abort();}
  return route.continue();
 });
 return external;
}
test('QA genuine same-origin Tesseract browser pixels with independent oracle',async({page,context})=>{
 const outside=await localOnly(context);
 await page.goto('/demo/review.html');
 await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
 await page.evaluate(async()=>{
  if(!window.Tesseract?.createWorker)throw new Error('No local Tesseract');
  window.qaWorker=await window.Tesseract.createWorker('eng',1,{
   workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
   corePath:location.origin+'/demo/vendor/ocr/core',
   langPath:location.origin+'/demo/vendor/ocr/lang',
   gzip:false,workerBlobURL:false,cacheMethod:'none'
  });
 });
 let fieldsRight=0,baselineRight=0,baselineTotal=0;
 const results=[];
 try{
  for(const item of cases()){
   const response=await page.evaluate(async o=>{
    const c=document.createElement('canvas'),w=o.width;
    c.width=w;c.height=Math.round(w*0.34);
    const x=c.getContext('2d');
    x.fillStyle=o.dark?'#17232c':'#f7f7f8';x.fillRect(0,0,w,c.height);
    x.fillStyle=o.dark?'white':'#111';
    x.font='bold '+o.font+'px Arial';
    x.fillText('SYNTHETIC PORTFOLIO',w*0.04,c.height*0.22);
    x.font=o.font+'px Arial';
    x.fillText('Ticker       Qty      Quote EUR      Value EUR',w*0.04,c.height*0.46);
    x.font='bold '+o.font+'px Arial';
    x.fillText(o.name+'       '+o.qty+'        '+
     o.price.toFixed(2).replace('.',',')+'       '+o.value.toFixed(2).replace('.',','),
     w*0.04,c.height*0.7);
    const png=c.toDataURL(o.jpeg?'image/jpeg':'image/png',o.jpeg?0.45:1);
    const recognized=await window.qaWorker.recognize(png);
    return {text:recognized.data.text,confidence:recognized.data.confidence};
   },item);
   const s=score(response.text,item);
   fieldsRight+=Number(s.ticker)+Number(s.quantity)+Number(s.price)+Number(s.value);
   if(item.class==='baseline'){baselineTotal++;baselineRight+=Number(s.all);}
   results.push({seed:item.seed,index:item.index,class:item.class,match:s,
    confidence:Math.round(response.confidence)});
  }
 }finally{
  await page.evaluate(async()=>{await window.qaWorker.terminate();delete window.qaWorker;});
 }
 console.log('QA_REAL_PIXEL_OCR '+JSON.stringify({
  images:results.length,baselineExact:baselineRight,baselineTotal,
  fieldsExact:fieldsRight,totalFields:results.length*4,
  outsideOriginRequests:outside.length,results
 }));
 expect(outside).toEqual([]);
 expect(results.length).toBe(16);
 expect(baselineRight).toBeGreaterThanOrEqual(3);
 expect(fieldsRight).toBeGreaterThanOrEqual(20);
});
test('QA real on-device image UI only uses same-origin OCR assets',async({page,context})=>{
 const outside=await localOnly(context);
 await page.goto('/demo/review.html');
 const image=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1050;c.height=300;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1050,300);
  ctx.fillStyle='#111';ctx.font='bold 40px Arial';
  ctx.fillText('SYNTHETIC PORTFOLIO',35,75);
  ctx.fillText('ASTERONE 8 kpl 14,20 EUR 113,60 EUR',35,150);
  return c.toDataURL('image/png');
 });
 await page.locator('#sourceFile').setInputFiles({name:'qa-synthetic.png',
  mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
 await page.locator('#analyzeBtn').click();
 await expect(page.locator('#status')).toContainText('Esitarkistus valmis',{timeout:180000});
 await expect(page.locator('#formatText')).toHaveText('Kuva/OCR');
 await expect(page.locator('#issues')).toContainText('OCR_NOT_SEMANTICALLY_VERIFIED');
 await expect(page.locator('#issues')).toContainText('OCR_DECIMAL_PUNCTUATION_RISK');
 await expect(page.locator('button')).toHaveCount(2);
 expect(outside).toEqual([]);
 console.log('QA_REAL_OCR_UI '+JSON.stringify({sameOrigin:true,
  words:await page.locator('#observationCount').textContent(),reviewOnly:true}));
});
