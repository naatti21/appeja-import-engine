import {test,expect} from '@playwright/test';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';
import {seeded} from '../qa/generator.mjs';

const round=n=>Math.round(n*100)/100;
const fmt=n=>round(n).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,' ');
function oracle(seed,index){
 const random=seeded((seed+Math.imul(index+1,19349663))>>>0);
 const gross=round(1100+random()*5200);
 const net=round(gross*(0.51+random()*0.38));
 const ytd=round(gross*(4+Math.floor(random()*8)));
 const withheld=round(gross-net);
 const mo=1+Math.floor(random()*12),day=1+Math.floor(random()*28);
 const date='2026-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 const printable=String(day).padStart(2,'0')+'.'+String(mo).padStart(2,'0')+'.2026';
 return {seed,index,gross,net,ytd,withheld,date,printable};
}
function payslip(data,mode){
 const header=data.index%2?'Vuoden tiedot':'KERTYMÄ VUODEN ALUSTA';
 const period=data.index%2?'Kauden tiedot':'KERTYMÄ PALKKAKAUDELTA';
 const netLabel=['Maksetaan','Nettopalkka','Käteen maksettava'][data.index%3];
 const dateLabel=['Maksupäivä','Maksupvm','Palkanmaksupäivä'][data.index%3];
 const amount=(n)=>fmt(n);
 const lines=[
 'PALKKALASKELMA',
 'Palkkakausi 01.08.2026 - 14.08.2026',
 dateLabel+' '+data.printable,
 netLabel+' '+amount(mode==='netAboveGross'?data.gross+35:data.net),
 period,
 'Ennakonpid. al. tul '+amount(data.gross),
 'Ennakonpidätys -'+amount(data.withheld),
 header,
 'Ennakonpid. al. tul '+amount(data.ytd),
 'Ennakonpidätys -'+amount(data.withheld*5)
 ];
 if(mode==='conflictYtd')lines.splice(9,0,'Ennakonpid. al. tul '+amount(data.ytd+2));
 if(mode==='missingYtd')lines.splice(8,1);
 if(mode==='missingPayDate')lines.splice(2,1);
 if(mode==='unaccountedCash')lines.push('Tuntematon summa '+amount(87.17));
 return completePayslipPdf(lines.join('\n'));
}
const modes=['clean','conflictYtd','missingYtd','missingPayDate','netAboveGross','unaccountedCash'];
const expected={
 conflictYtd:'CONFLICT',missingYtd:'MISSING_FIELD',
 missingPayDate:'MISSING_FIELD',netAboveGross:'NET_EXCEEDS_GROSS',unaccountedCash:'UNACCOUNTED_MATERIAL'
};
for(const seed of [31,79,127]){
 test('QA generated native PDF.js salary oracle seed '+seed,async({page})=>{
  await page.goto('/demo/');
  let clean=0,blocked=0,observations=0;
  for(let index=0;index<8;index++){
   const data=oracle(seed,index);
   for(const mode of modes){
    const bytes=payslip(data,mode);
    const actual=await page.evaluate(async payload=>{
      const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
      const {readPdfWithPdfJs}=await import('/src/layout.mjs');
      const {parsePayrollSections}=await import('/src/payroll-sections.mjs');
      const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(payload));
      const parsed=parsePayrollSections(layout);
      const fields=Object.fromEntries(Object.entries(parsed.fields)
       .map(([key,f])=>[key,{status:f.status,value:f.value,sourceIds:f.sourceIds}]));
      const ids=new Set(layout.observations.map(x=>x.id));
      return {fields,codes:parsed.decision.problems.map(x=>x.code),
       sourceOk:Object.values(fields).every(f=>f.status!=='verified'||(
        f.sourceIds.length>0&&f.sourceIds.every(id=>ids.has(id)))),
       canPersist:parsed.decision.canPersist,observations:layout.observations.length};
    },Array.from(bytes));
    const replay='seed='+seed+' index='+index+' mode='+mode;
    expect(actual.canPersist,replay+' cannot persist').toBe(false);
    expect(actual.sourceOk,replay+' source IDs').toBe(true);
    expect(actual.observations,replay+' raw observations').toBeGreaterThan(5);
    if(mode==='clean'){
     for(const [key,value] of Object.entries({
      payDate:data.date,grossPay:data.gross,netPay:data.net,
      ytdTaxableIncome:data.ytd,withholdingPeriod:data.withheld
     })){
      expect(actual.fields[key].status,replay+' '+key+' status').toBe('verified');
      expect(actual.fields[key].value,replay+' '+key+' independent oracle').toBe(value);
     }
     expect(actual.codes,replay+' no critical money conflict').not.toContain('CONFLICT');
     clean++;
    }else{
     expect(actual.codes,replay+' blocker').toContain(expected[mode]);
     if(mode==='conflictYtd')
      expect(actual.fields.ytdTaxableIncome.status).toBe('conflict');
     if(mode==='missingYtd')
      expect(actual.fields.ytdTaxableIncome.status).toBe('missing');
     if(mode==='missingPayDate')
      expect(actual.fields.payDate.status).toBe('missing');
     blocked++;
    }
    observations+=actual.observations;
   }
  }
  console.log('QA_NATIVE_PDF '+JSON.stringify({seed,clean,negativeBlocked:blocked,
   nativePdfs:clean+blocked,observations}));
 });
}
test('QA mobile layout smoke across four phone/tablet viewports',async({page})=>{
 const csv='Ticker,Quantity,Buy Price,Currency\nSYNTHETIC,12,3.55,EUR';
 const sizes=[[320,650],[360,740],[412,915],[768,1024]];
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  await page.goto('/demo/review.html');
  await page.locator('#sourceFile').setInputFiles({
   name:'qa-synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)
  });
  await page.locator('#analyzeBtn').click();
  await expect(page.getByRole('status')).toContainText('Esitarkistus valmis');
  await expect(page.locator('#candidates')).toContainText('SYNTHETIC');
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('button')).toHaveCount(2);
  const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
  expect(fits,'horizontal screen overflow at '+width).toBe(true);
 }
 console.log('QA_MOBILE_VIEWPORTS '+JSON.stringify({tested:sizes.map(x=>x.join('x'))}));
});
