import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';

const variants=[
 {id:'a-modern',date:'2026-08-28',gross:4698.11,net:2678.39,ytd:63832.82},
 {id:'b-compact',date:'2026-08-28',gross:4698.11,net:2678.39,ytd:63832.82},
 {id:'c-alt-terms',date:'2026-08-28',gross:4698.11,net:2678.39,ytd:63832.82}
];
for(const fixture of variants){
 test('complete synthetic payslip '+fixture.id+': real PDF.js + frozen full parser + safety contract',async({page})=>{
  const source=await readFile(new URL('../fixtures/complete-payslips/'+fixture.id+'.txt',import.meta.url),'utf8');
  const result=await page.goto('/demo/').then(()=>page.evaluate(async bytes=>{
   const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
   const {readPdfWithPdfJs}=await import('/src/layout.mjs');
   const {pageItemsToLines}=await import('/tests/fixtures/legacy-lines.mjs');
   const {parsePayslip}=await import('/tests/fixtures/palkka-frozen/parser.js');
   const {parsePayrollLayout}=await import('/src/payroll.mjs');
   const {evaluateImportCandidate}=await import('/src/acceptance.mjs');
   const task=pdfjs.getDocument({data:new Uint8Array(bytes)});
   let lines;
   try{
    const pdf=await task.promise;
    const page=await pdf.getPage(1);
    lines=pageItemsToLines((await page.getTextContent()).items,1);
   }finally{await task.destroy();}
   const old=parsePayslip({text:lines.map(l=>l.text).join('\n'),lines});
   const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes));
   const lab=parsePayrollLayout(layout);
   // The LAB currently extracts cumulative values, not the complete 4 mandatory
   // payroll fields. Do NOT fabricate net and date evidence from the frozen parser.
   const fields={};
   for(const role of ['grossPay','ytdTaxableIncome','previousYearTaxableIncome']){
    const f=lab.fields[role];
    fields[role]={value:f.value,
     status:f.status==='unique'?'verified':f.status==='conflict'?'conflict':'unverified',
     sourceIds:(f.candidates??[]).map(c=>c.observationId)};
   }
   const decision=evaluateImportCandidate({app:'palkka',documentType:'payslip',fields,
    observations:layout.observations.map(o=>({id:o.id,raw:o.raw,material:false})),issues:lab.issues});
   return {old:{documentType:old.documentType,
      payDate:old.fields.payDate?.value,grossPay:old.fields.grossPay?.value,
      netPay:old.fields.netPay?.value,ytdTaxableIncome:old.fields.ytdTaxableIncome?.value,
      blockers:old.notices?.filter(n=>n.level==='blocking').map(n=>n.code)??[]},
    lab:{grossPay:lab.fields.grossPay?.value??null,
         ytdTaxableIncome:lab.fields.ytdTaxableIncome?.value??null,
         blocks:lab.blocks,canAutoAccept:lab.canAutoAccept},
    decision:{status:decision.status,canPersist:decision.canPersist,
              reasons:decision.problems.map(p=>p.code)},
    observations:layout.observations.length};
  },Array.from(completePayslipPdf(source))));
  console.log('COMPLETE_SYNTHETIC_PAYSLIP '+fixture.id+' '+JSON.stringify(result));
  expect(result.old.documentType).toBe('payslip');
  expect(result.old.payDate).toBe(fixture.date);
  expect(result.old.grossPay).toBe(fixture.gross);
  expect(result.old.netPay).toBe(fixture.net);
  expect(result.old.ytdTaxableIncome).toBe(fixture.ytd);
  expect(result.observations).toBeGreaterThan(12);
  // The research adapter is intentionally not misrepresented as a full payslip parser.
  expect(result.decision.status).toBe('review-required');
  expect(result.decision.canPersist).toBe(false);
  expect(result.decision.reasons).toContain('MISSING_FIELD');
 });
}
