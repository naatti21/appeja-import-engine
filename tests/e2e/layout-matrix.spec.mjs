import {test,expect} from '@playwright/test';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';
import {layoutCases} from '../fixtures/layout-cases.mjs';

for(const fixture of layoutCases){
  test('layout matrix: '+fixture.id,async({page})=>{
    await page.goto('/demo/');
    const result=await page.evaluate(async bytes=>{
      const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
      const {readPdfWithPdfJs}=await import('/src/layout.mjs');
      const {parsePayrollLayout}=await import('/src/payroll.mjs');
      try{
        const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes));
        const parsed=parsePayrollLayout(layout);
        return {rejected:false,issues:parsed.issues,fields:parsed.fields,
          canAutoAccept:parsed.canAutoAccept,observationCount:layout.observations.length,
          pageCount:layout.pages.length,unmatched:parsed.unmatched};
      }catch(error){return {rejected:true,message:String(error?.message??error)};}
    },Array.from(syntheticPayrollPdf(fixture.pages)));
    if(fixture.issue==='PDF_BRIDGE_REJECT'){
      expect(result.rejected,JSON.stringify(result)).toBe(true);
      return;
    }
    expect(result.rejected,JSON.stringify(result)).toBe(false);
    expect(result.canAutoAccept,fixture.id+': '+JSON.stringify(result.issues)).toBe(fixture.safe);
    if(fixture.safe){
      expect(result.fields.ytdTaxableIncome.value).toBe(fixture.values.ytd);
      expect(result.fields.grossPay.value).toBe(fixture.values.gross);
      expect(result.fields.previousYearTaxableIncome.value).toBe(fixture.values.previous);
    }else if(fixture.issue==='conflict'){
      expect(result.fields.ytdTaxableIncome.status).toBe('conflict');
      expect(result.fields.ytdTaxableIncome.candidates.map(c=>c.value)).toContain(43000);
    }else{
      expect(result.issues.some(x=>x.code===fixture.issue),JSON.stringify(result)).toBe(true);
    }
  });
}

test('same PDF input: old line folding vs item-level geometric evidence',async({page})=>{
  await page.goto('/demo/');
  const result=await page.evaluate(async data=>{
    const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
    const {readPdfWithPdfJs}=await import('/src/layout.mjs');
    const {pageItemsToLines}=await import('/tests/fixtures/legacy-lines.mjs');
    const original=await pdfjs.getDocument({data:new Uint8Array(data)}).promise;
    const oldLines=[];
    for(let n=1;n<=original.numPages;n++){
      const page=await original.getPage(n);
      const items=(await page.getTextContent()).items;
      oldLines.push(...pageItemsToLines(items,n));
    }
    await original.destroy();
    const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(data));
    const rawAmounts=layout.observations.filter(o=>/^(?:3 200|42 000|43 000|38 000),00$/.test(o.raw.trim()));
    return {oldLines,newTokens:layout.observations.length,amounts:rawAmounts.map(o=>({page:o.page,x:o.box.x0,raw:o.raw})),
      oldAmountLines:oldLines.filter(l=>l.text.includes('42 000')||l.text.includes('43 000'))};
  },Array.from(syntheticPayrollPdf([{ytd:'42 000,00'},{ytd:'43 000,00'}])));
  expect(result.amounts).toHaveLength(6);
  expect(new Set(result.amounts.map(a=>a.page))).toEqual(new Set([1,2]));
  expect(result.oldAmountLines).toHaveLength(2);
  expect(result.oldAmountLines.every(l=>l.text.includes('3 200')&&l.text.includes('38 000'))).toBe(true);
  expect(result.newTokens).toBeGreaterThan(result.oldLines.length);
});
