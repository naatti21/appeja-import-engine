import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';

const sources=[
 {id:'a-modern',ytd:'Ennakonpid. al. tul 63 832,82',withhold:'Ennakonpidätys -18 792,51'},
 {id:'b-compact',ytd:'Ver.al.ans 63 832,82',withhold:'Enn.pid -18 792,51'},
 {id:'c-alt-terms',ytd:'Vuositulo tähän asti 63 832,82',withhold:null}
];
async function getFixture(id){
 return readFile(new URL('../fixtures/complete-payslips/'+id+'.txt',import.meta.url),'utf8');
}
async function read(page,source){
 await page.goto('/demo/');
 return page.evaluate(async data=>{
  const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
  const {readPdfWithPdfJs}=await import('/src/layout.mjs');
  const {parsePayrollSections}=await import('/src/payroll-sections.mjs');
  const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(data));
  const parsed=parsePayrollSections(layout);
  const compact=Object.fromEntries(Object.entries(parsed.fields).map(([key,f])=>
   [key,{value:f.value,status:f.status,sourceIds:f.sourceIds,candidates:f.candidates}]));
  return {fields:compact,issues:parsed.issues,decision:parsed.decision,
    observations:layout.observations.map(o=>({id:o.id,page:o.page,raw:o.raw}))};
 },Array.from(completePayslipPdf(source)));
}
function codes(result){return result.decision.problems.map(p=>p.code);}
for(const s of sources){
 test('v0.6 complete PDF section evidence: '+s.id,async({page})=>{
  const result=await read(page,await getFixture(s.id));
  const expected={payDate:'2026-08-28',grossPay:4698.11,netPay:2678.39,ytdTaxableIncome:63832.82};
  for(const [field,value] of Object.entries(expected)){
   expect(result.fields[field].value,s.id+' '+field).toBe(value);
   expect(result.fields[field].status,s.id+' '+field).toBe('verified');
   expect(result.fields[field].sourceIds.length,s.id+' '+field+' evidence').toBeGreaterThan(0);
   for(const id of result.fields[field].sourceIds)
    expect(result.observations.some(o=>o.id===id),id).toBe(true);
  }
  if(s.withhold){
   expect(result.fields.withholdingPeriod.value).toBe(1526.89);
   expect(result.fields.withholdingYtd.value).toBe(18792.51);
   expect(result.fields.withholdingPeriod.sourceIds.length).toBeGreaterThan(0);
  }else expect(result.fields.withholdingYtd.status).toBe('missing');
  // Pay lines and other ancillary monetary observations are not all mapped.
  expect(result.decision.status).toBe('review-required');
  expect(result.decision.canPersist).toBe(false);
  console.log('V06_FULL_PDF '+s.id+' '+JSON.stringify({
    core:Object.fromEntries(Object.keys(expected).map(k=>[k,result.fields[k].value])),
    status:result.decision.status,reviewReasons:[...new Set(codes(result))],
    locatedEvidence:result.observations.length
  }));
 });
 test('v0.6 conflicting YTD cannot be silently accepted: '+s.id,async({page})=>{
  const fixture=await getFixture(s.id);
  expect(fixture).toContain(s.ytd);
  const duplicate=s.ytd.replace('63 832,82','63 833,82');
  const result=await read(page,fixture.replace(s.ytd,s.ytd+'\n'+duplicate));
  expect(result.fields.ytdTaxableIncome.status).toBe('conflict');
  expect(codes(result)).toContain('CONFLICT');
  expect(result.decision.canPersist).toBe(false);
 });
 test('v0.6 missing YTD is not reconstructed from nearby amounts: '+s.id,async({page})=>{
  const fixture=await getFixture(s.id);
  const result=await read(page,fixture.replace(s.ytd,''));
  expect(result.fields.ytdTaxableIncome.status).toBe('missing');
  expect(codes(result)).toContain('MISSING_FIELD');
 });
}
for(const s of sources.filter(x=>x.withhold)){
 test('v0.6 annual withholding conflict remains a separate role: '+s.id,async({page})=>{
  const fixture=await getFixture(s.id);
  const duplicate=s.withhold.replace('18 792,51','18 793,51');
  const result=await read(page,fixture.replace(s.withhold,s.withhold+'\n'+duplicate));
  expect(result.fields.withholdingYtd.status).toBe('conflict');
  expect(result.fields.withholdingPeriod.value).toBe(1526.89);
  expect(codes(result)).toContain('CONFLICT');
 });
}
test('v0.6 overlarge net pay blocks even with correct source IDs',async({page})=>{
 const source=(await getFixture('c-alt-terms')).replace('Käteen maksettava 2 678,39','Käteen maksettava 5 678,39');
 const result=await read(page,source);
 expect(result.fields.netPay.value).toBe(5678.39);
 expect(codes(result)).toContain('NET_EXCEEDS_GROSS');
});
test('v0.6 unexplained financial row cannot be discarded',async({page})=>{
 const source=(await getFixture('c-alt-terms'))+'\nYlimääräinen summa 99 999,99';
 const result=await read(page,source);
 expect(codes(result)).toContain('UNACCOUNTED_MATERIAL');
 expect(result.decision.canPersist).toBe(false);
});
