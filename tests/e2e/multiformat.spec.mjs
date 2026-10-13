import {test,expect} from '@playwright/test';
import {syntheticHoldingsXlsx} from '../fixtures/native-xlsx.mjs';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';

const csv=['Ticker,Name,Quantity,Buy Price,Currency','NOKIA,Nokia,10,3.5,EUR','MSFT,Microsoft,2,400,USD'].join('\n');
const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const ocr=[header,
 '5\t1\t1\t1\t1\t1\t12\t20\t42\t18\t92\tNOKIA',
 '5\t1\t1\t1\t1\t2\t170\t20\t14\t18\t94\t10',
 '5\t1\t1\t1\t2\t1\t12\t55\t54\t18\t78\tMSFT'
].join('\n');

test('multi-format real Chromium: compressed XLSX equals CSV holdings',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async data=>{
  const {parseXlsx,xlsxSheetToHoldingsTable}=await import('/src/xlsx.mjs');
  const {parseHoldingsCsv}=await import('/src/holdings.mjs');
  const {evidenceFromDelimited,evidenceFromXlsx}=await import('/src/import-observations.mjs');
  const workbook=await parseXlsx(new Uint8Array(data.bytes));
  const xlsxRecords=parseHoldingsCsv(xlsxSheetToHoldingsTable(workbook,'Salkku'));
  const csvRecords=parseHoldingsCsv(data.csv);
  const fields=r=>r.records.map(x=>Object.fromEntries(
   ['ticker','name','quantity','buyPrice','currency'].map(k=>[k,x.fields[k]?.value??null])));
  const xlsxEvidence=await evidenceFromXlsx(new Uint8Array(data.bytes));
  const csvEvidence=evidenceFromDelimited(data.csv);
  return {x:fields(xlsxRecords),c:fields(csvRecords),issues:workbook.issues,
   sheetNames:workbook.sheets.map(s=>s.name),
   xlsxEvidence:xlsxEvidence.observations.length,csvEvidence:csvEvidence.observations.length,
   source: xlsxEvidence.observations.find(x=>x.source.address==='D3').source,
   canPersist:xlsxEvidence.canPersist};
 },{bytes:Array.from(syntheticHoldingsXlsx()),csv});
 expect(result.x).toEqual(result.c);
 expect(result.x).toHaveLength(2);
 expect(result.issues).toHaveLength(0);
 expect(result.sheetNames).toEqual(['Salkku','Meta']);
 expect(result.xlsxEvidence).toBeGreaterThan(result.csvEvidence);
 expect(result.source.sheet).toBe('Salkku');
 expect(result.source.address).toBe('D3');
 expect(result.canPersist).toBe(false);
 console.log('V08_XLSX_CSV_REAL '+JSON.stringify(result));
});

test('multi-format real Chromium: formula result is not automatically verified',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async bytes=>{
  const {evidenceFromXlsx}=await import('/src/import-observations.mjs');
  const result=await evidenceFromXlsx(new Uint8Array(bytes));
  return {issues:result.issues,canPersist:result.canPersist,requiresReview:result.requiresReview,
   cell:result.observations.find(x=>x.source.address==='D3')};
 },Array.from(syntheticHoldingsXlsx({formula:true})));
 expect(result.issues.map(x=>x.code)).toContain('FORMULA_VALUE_UNVERIFIED');
 expect(result.cell.formula).toBe(true);
 expect(result.canPersist).toBe(false);
 expect(result.requiresReview).toBe(true);
});

test('multi-format real Chromium: native portfolio PDF preserves source, not assumed holdings',async({page})=>{
 const source=['SYNTHETIC TEST PORTFOLIO','Ticker Name Quantity Buy Price Currency',
   'NOKIA Nokia 10 3.5 EUR','MSFT Microsoft 2 400 USD'].join('\n');
 await page.goto('/demo/');
 const result=await page.evaluate(async bytes=>{
  const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
  const {readPdfWithPdfJs}=await import('/src/layout.mjs');
  const {evidenceFromPdfLayout}=await import('/src/import-observations.mjs');
  const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes));
  const observations=evidenceFromPdfLayout(layout);
  return {read:observations.observations.map(x=>x.raw),
   count:observations.observations.length,issues:observations.issues,
   canPersist:observations.canPersist,first:observations.observations[0]?.source};
 },Array.from(completePayslipPdf(source)));
 expect(result.count).toBeGreaterThanOrEqual(4);
 expect(result.read.join(' ')).toContain('NOKIA');
 expect(result.read.join(' ')).toContain('MSFT');
 expect(result.first.page).toBe(1);
 expect(result.canPersist).toBe(false);
 console.log('V08_PDF_RAW '+JSON.stringify({count:result.count,issues:result.issues.length}));
});

test('multi-format Chromium: pre-extracted screenshot OCR TSV retains words, not a proven image OCR result',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async text=>{
  const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
  const result=evidenceFromOcrTsv(text,{imageWidth:400,imageHeight:200});
  return {raw:result.observations.map(x=>x.raw),
   confidence:result.observations[0].ocrConfidence,
   source:result.observations[0].source,canPersist:result.canPersist,review:result.requiresReview};
 },ocr);
 expect(result.raw).toEqual(['NOKIA','10','MSFT']);
 expect(result.confidence).toBe(92);
 expect(result.source.format).toBe('image-ocr');
 expect(result.canPersist).toBe(false);
 expect(result.review).toBe(true);
});
