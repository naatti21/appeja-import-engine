import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';

const fixtures=[['a-modern',11],['b-compact',12],['c-alt-terms',9]];
async function source(id){
 return readFile(new URL('../fixtures/complete-payslips/'+id+'.txt',import.meta.url),'utf8');
}
async function compare(page,text){
 await page.goto('/demo/');
 return page.evaluate(async data=>{
  const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
  const {readPdfWithPdfJs}=await import('/src/layout.mjs');
  const {parsePayrollSections}=await import('/src/payroll-sections.mjs');
  const {parsePayslip}=await import('/tests/fixtures/palkka-frozen/parser.js');
  const {pageItemsToLines}=await import('/tests/fixtures/legacy-lines.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(data)});
  let text;
  try{
   const pdf=await task.promise;
   const rows=[];
   for(let n=1;n<=pdf.numPages;n++){
    const pg=await pdf.getPage(n);
    rows.push(pageItemsToLines((await pg.getTextContent()).items,n));
   }
   text=rows.map(r=>r.map(x=>x.text).join('\n')).join('\n\n');
  }finally{await task.destroy();}
  const frozen=parsePayslip(text);
  const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(data));
  const next=parsePayrollSections(layout);
  const liveIds=new Set(layout.observations.map(o=>o.id));
  const evidenceOk=next.payLines.every(line=>line.sourceIds.length>0&&line.sourceIds.every(id=>liveIds.has(id)));
  const oldLines=frozen.payLines.map(l=>({
   code:l.code,quantity:l.quantity,unitPrice:l.unitPrice,amount:l.amount
  }));
  const newLines=next.payLines.map(l=>({
   code:l.code,quantity:l.quantity,unitPrice:l.unitPrice,amount:l.amount
  }));
  return {oldLines,newLines,knownCount:next.payLines.length,
    badLines:next.unmatchedPayLines,issues:next.issues,
    coverage:next.coverage,validRefs:evidenceOk,
    decision:next.decision,withholdingPeriod:next.fields.withholdingPeriod?.value??null,
    withholdingYtd:next.fields.withholdingYtd?.value??null};
 },Array.from(completePayslipPdf(text)));
}
for(const [id,count] of fixtures){
 test('v0.7 real PDF payline provenance & frozen parser parity: '+id,async({page})=>{
  const r=await compare(page,await source(id));
  expect(r.knownCount).toBe(count);
  expect(r.badLines).toHaveLength(0);
  expect(r.validRefs).toBe(true);
  expect(r.newLines).toEqual(r.oldLines);
  expect(r.coverage.paylineRowsRecognized).toBe(count);
  expect(r.coverage.unresolvedObservations).toBeGreaterThan(0);
  expect(r.coverage.coveredObservations).toBeGreaterThan(count-1);
  expect(r.decision.status).toBe('review-required');
  expect(r.decision.canPersist).toBe(false);
  console.log('V07_COVERAGE '+JSON.stringify({id,recognized:count,...r.coverage,
    issues:[...new Set(r.issues.map(x=>x.code))]}));
 });
}
test('v0.7 invalid amount in native PDF is blocked',async({page})=>{
 const s=(await source('a-modern')).replace('7,90 25,07 99,03','7,90 25,07 299,03');
 const r=await compare(page,s);
 expect(r.issues.some(i=>i.code==='PAYLINE_ARITHMETIC_MISMATCH')).toBe(true);
 expect(r.badLines.some(x=>x.raw.includes('299,03'))).toBe(true);
 expect(r.decision.problems.map(x=>x.code)).toContain('UNACCOUNTED_MATERIAL');
});
test('v0.7 unknown payline from real PDF is not treated as known',async({page})=>{
 const s=(await source('c-alt-terms'))+'\n29999 Uusi palkkalaji 1,00 10,00 10,00';
 const r=await compare(page,s);
 expect(r.issues.some(x=>x.code==='UNKNOWN_PAYLINE_CODE')).toBe(true);
 expect(r.badLines).toHaveLength(1);
 expect(r.decision.canPersist).toBe(false);
});
test('v0.7 withholding row contradicting subtotal blocks import',async({page})=>{
 const s=(await source('a-modern')).replace(
  '90000 Ennakonpidätys 8 028,58 -1 526,89',
  '90000 Ennakonpidätys 8 028,58 -1 525,89');
 const r=await compare(page,s);
 expect(r.issues.some(x=>x.code==='WITHHOLDING_PERIOD_MISMATCH')).toBe(true);
 expect(r.withholdingPeriod).toBe(1526.89);
 expect(r.decision.canPersist).toBe(false);
});
