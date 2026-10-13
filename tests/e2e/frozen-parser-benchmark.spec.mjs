import {test,expect} from '@playwright/test';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';
import {scenarios} from '../fixtures/benchmark-75.mjs';

test('75 PDFs: same input through full frozen Palkka parser and LAB adapter',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/demo/');
  const outcomes=await page.evaluate(async fixtures=>{
    const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
    const {readPdfWithPdfJs}=await import('/src/layout.mjs');
    const {parsePayrollLayout}=await import('/src/payroll.mjs');
    const {pageItemsToLines}=await import('/tests/fixtures/legacy-lines.mjs');
    const {parsePayslip}=await import('/tests/fixtures/palkka-frozen/parser.js');
    const results=[];
    for(const fixture of fixtures){
      const data=new Uint8Array(fixture.bytes);
      const loadingTask=pdfjs.getDocument({data:data.slice()});
      let original;
      const grouped=[];
      try {
        original=await loadingTask.promise;
        for(let p=1;p<=original.numPages;p++){
          const page=await original.getPage(p);
          grouped.push(pageItemsToLines((await page.getTextContent()).items,p));
          page.cleanup?.();
        }
      }finally {await loadingTask.destroy();}
      // Exactly the same line and text construction as the frozen Palkka pdf-reader.
      const oldLines=grouped.flatMap((lines,i)=>i===0?lines:[null,...lines]);
      const oldText=grouped.map(lines=>lines.map(line=>line.text).join('\n')).join('\n\n');
      const old=parsePayslip({text:oldText,lines:oldLines});
      const layout=await readPdfWithPdfJs(pdfjs,data.slice());
      const current=parsePayrollLayout(layout);
      const oldValues=Object.fromEntries(['grossPay','ytdTaxableIncome','previousYearTaxableIncome'].map(k=>[k,old.fields[k]?.value??null]));
      const newValues={
        grossPay:current.fields.grossPay.value,
        ytdTaxableIncome:current.fields.ytdTaxableIncome.value,
        previousYearTaxableIncome:current.fields.previousYearTaxableIncome.value
      };
      const oldBlockers=old.notices?.filter(n=>n.level==='blocking').map(n=>n.code)??[];
      results.push({
        id:fixture.id,kind:fixture.kind,oracle:fixture.oracle,
        ...(fixture.id.endsWith('--clean')&&fixture.id.startsWith('01-') ? {diagnostic:{oldText:oldText.slice(0,1600),oldWarnings:old.notices?.map(n=>({level:n.level,code:n.code})),oldFieldSources:Object.fromEntries(['grossPay','ytdTaxableIncome','previousYearTaxableIncome'].map(k=>[k,old.fields[k]?.source??null]))}} : {}),
        old:{values:oldValues,documentType:old.documentType,sourceProfile:old.sourceProfile,
          blockingCodes:oldBlockers,fieldConflicts:Object.fromEntries(['grossPay','ytdTaxableIncome','previousYearTaxableIncome'].map(k=>[k,Boolean(old.fields[k]?.conflict||old.fields[k]?.evidenceIssue)]))},
        lab:{values:newValues,canAutoAccept:current.canAutoAccept,blockingCodes:current.issues.map(i=>i.code),
          ytdStatus:current.fields.ytdTaxableIncome.status},
        evidence:{rawTokens:layout.observations.length,oldMergedLines:oldLines.filter(Boolean).length,
          locatedTokens:layout.observations.filter(t=>t.box).length,
          unmatched:current.unmatched.length}
      });
    }
    return results;
  },scenarios.map(s=>({
    id:s.id,kind:s.kind,oracle:s.oracle,
    bytes:Array.from(syntheticPayrollPdf(s.pages))
  })));
  expect(outcomes).toHaveLength(75);
  const metrics={total:outcomes.length,clean:0,adversarial:0,labCorrectClean:0,
    labBlockedUnsafe:0,oldCorrectAllThree:0,oldNoBlockingUnsafe:0,
    oldGrossCorrect:0,oldYtdCorrect:0,oldPreviousCorrect:0,
    sourceTokens:0,oldFoldedLines:0,missingGeometry:0,
    oldPayslipClassification:0,oldErrorCases:[],labErrorCases:[],
    oldUnblockedNegativeExamples:[]};
  for(const r of outcomes){
    metrics.sourceTokens+=r.evidence.rawTokens;
    metrics.oldFoldedLines+=r.evidence.oldMergedLines;
    metrics.missingGeometry+=r.evidence.rawTokens-r.evidence.locatedTokens;
    const o=r.oracle;
    if(o.safe){
      metrics.clean++;
      const correct=r.lab.canAutoAccept &&
        r.lab.values.grossPay===o.gross &&
        r.lab.values.ytdTaxableIncome===o.ytd &&
        r.lab.values.previousYearTaxableIncome===o.previous;
      if(correct)metrics.labCorrectClean++;
      else metrics.labErrorCases.push({id:r.id,status:'wrong-clean-values',lab:r.lab,expected:o});
      if(r.old.values.grossPay===o.gross)metrics.oldGrossCorrect++;
      if(r.old.values.ytdTaxableIncome===o.ytd)metrics.oldYtdCorrect++;
      if(r.old.values.previousYearTaxableIncome===o.previous)metrics.oldPreviousCorrect++;
      if(r.old.values.grossPay===o.gross &&
         r.old.values.ytdTaxableIncome===o.ytd &&
         r.old.values.previousYearTaxableIncome===o.previous)metrics.oldCorrectAllThree++;
      if(r.old.documentType==='payslip')metrics.oldPayslipClassification++;
    }else{
      metrics.adversarial++;
      if(!r.lab.canAutoAccept &&
        (o.problem==='conflict'
          ? r.lab.ytdStatus==='conflict'
          : r.lab.blockingCodes.includes('MISSING_TABLE_VALUE')))metrics.labBlockedUnsafe++;
      else metrics.labErrorCases.push({id:r.id,status:'negative-not-blocked',lab:r.lab,expected:o});
      if(r.old.blockingCodes.length===0){
        metrics.oldNoBlockingUnsafe++;
        metrics.oldUnblockedNegativeExamples.push({id:r.id,oldValues:r.old.values,classification:r.old.documentType});
      }
    }
  }
  console.log('FROZEN_PARSER_DIAGNOSTIC '+JSON.stringify(outcomes.find(r=>r.diagnostic)?.diagnostic));
  console.log('FULL_FROZEN_PARSER_VS_LAB_75 '+JSON.stringify(metrics));
  expect(metrics.clean).toBe(25);
  expect(metrics.adversarial).toBe(50);
  expect(metrics.missingGeometry).toBe(0);
  expect(metrics.labErrorCases,'New engine false match/rejection: '+JSON.stringify(metrics.labErrorCases)).toEqual([]);
  expect(metrics.labCorrectClean).toBe(25);
  expect(metrics.labBlockedUnsafe).toBe(50);
});
