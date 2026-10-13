import {test,expect} from '@playwright/test';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';

/** Real PDF bytes -> real PDF.js Chromium worker -> item geometry -> payroll adapter. */
async function read(page, opts) {
  await page.goto('/demo/');
  return page.evaluate(async raw=>{
    const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
    const {readPdfWithPdfJs}=await import('/src/layout.mjs');
    const {parsePayrollLayout}=await import('/src/payroll.mjs');
    const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(raw));
    return {layout,parsed:parsePayrollLayout(layout)};
  }, Array.from(syntheticPayrollPdf(opts)));
}

test('P0-04: 42k and 43k on two actual PDF pages must be kept and block',async({page})=>{
  const {layout,parsed}=await read(page,[{ytd:'42 000,00'},{ytd:'43 000,00'}]);
  expect(layout.pages).toHaveLength(2);
  expect(layout.observations.some(t=>t.page===2 && t.raw.includes('43 000'))).toBeTruthy();
  expect(parsed.fields.ytdTaxableIncome.status).toBe('conflict');
  expect(parsed.fields.ytdTaxableIncome.candidates.map(c=>c.value)).toEqual([42000,43000]);
  expect(parsed.canAutoAccept).toBe(false);
});
test('identical repeated YTDs on different PDF pages are not a conflict',async({page})=>{
  const {parsed}=await read(page,[{ytd:'42 000,00'},{ytd:'42 000,00'}]);
  expect(parsed.fields.ytdTaxableIncome.status).toBe('unique');
  expect(parsed.fields.ytdTaxableIncome.candidates).toHaveLength(2);
  expect(parsed.canAutoAccept).toBe(true);
});
test('PDF.js coordinates support reversed column ordering',async({page})=>{
  const {parsed}=await read(page,[{reverse:true}]);
  expect(parsed.fields.grossPay.value).toBe(3200);
  expect(parsed.fields.ytdTaxableIncome.value).toBe(42000);
  expect(parsed.fields.previousYearTaxableIncome.value).toBe(38000);
  expect(parsed.canAutoAccept).toBe(true);
});
test('P0-03: conflicting duplicate table on one real PDF page does not collapse',async({page})=>{
  const {parsed}=await read(page,[{secondBlock:'43 000,00'}]);
  expect(parsed.fields.ytdTaxableIncome.status).toBe('conflict');
  expect(parsed.blocks).toBe(2);
  expect(parsed.canAutoAccept).toBe(false);
});
test('missing PDF column is not invented',async({page})=>{
  const {parsed}=await read(page,[{includeYtd:false}]);
  expect(parsed.fields.ytdTaxableIncome.status).toBe('missing');
  expect(parsed.canAutoAccept).toBe(false);
});
test('synthetic-only demo uses real PDF.js on mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/demo/');
  await page.locator('#realPdf').click();
  await expect(page.locator('#result')).toContainText('PDF.js: oikea PDF-luku');
  await expect(page.locator('#result')).toContainText('Ristiriita');
  await expect(page.locator('#result')).toContainText('43 000,00');
});
