import {test,expect} from '@playwright/test';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';

test('YÖAJO 11: actual Chromium PDF.js text items -> immutable source IDs, two pages, review-only',async({page})=>{
  await page.goto('/demo/');
  const data=await page.evaluate(async bytes=>{
    const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
    const {fromPdfJsTextItems,inspectReadOnlyHandoff}=await import('/research/reader-bridge-v1/bridge.mjs');
    const task=pdfjs.getDocument({data:new Uint8Array(bytes)});
    const pdf=await task.promise;
    const pages=[];
    try{
      for(let i=1;i<=pdf.numPages;i++){
        const p=await pdf.getPage(i),viewport=p.getViewport({scale:1});
        pages.push({width:viewport.width,height:viewport.height,items:(await p.getTextContent()).items});
      }
    }finally{await task.destroy();}
    const layout=fromPdfJsTextItems(pages);
    const review=inspectReadOnlyHandoff(layout);
    return {sourceKind:layout.sourceKind,raw:layout.observations.map(o=>o.raw),
      pages:layout.pages.length,ids:layout.observations.map(o=>o.id),
      badGeometry:layout.issues.length,reviewStatus:review.status,
      canAutoAccept:review.canAutoAccept,canPersist:review.canPersist};
  },Array.from(syntheticPayrollPdf([{fullSlip:true},{ytd:'43 000,00',fullSlip:true}])));
  expect(data.sourceKind).toBe('pdf-text');
  expect(data.pages).toBe(2);
  expect(data.ids.length).toBeGreaterThan(10);
  expect(new Set(data.ids).size).toBe(data.ids.length);
  expect(data.ids.some(id=>id.startsWith('pdf-p2-'))).toBeTruthy();
  expect(data.raw.some(x=>x.includes('43 000'))).toBeTruthy();
  expect(data.badGeometry).toBe(0);
  expect(data.reviewStatus).toBe('review-required');
  expect(data.canAutoAccept).toBe(false);
  expect(data.canPersist).toBe(false);
});
test('YÖAJO 11: Chromium can parse synthetic Tesseract TSV without running OCR, no silent approvals',async({page})=>{
  await page.goto('/demo/');
  const r=await page.evaluate(async()=>{
    const {fromTesseractWordTsv,inspectReadOnlyHandoff}=await import('/research/reader-bridge-v1/bridge.mjs');
    const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+
      '5\t1\t1\t1\t1\t1\t10\t40\t100\t20\t89\tAccount\n'+
      '5\t1\t1\t1\t1\t2\t200\t40\t80\t20\t93\t0007\n';
    const layout=fromTesseractWordTsv(tsv,[{width:400,height:600}]);
    const result=inspectReadOnlyHandoff(layout);
    return {raw:layout.observations.map(o=>o.raw),ids:layout.observations.map(o=>o.id),
      issues:layout.issues,canAutoAccept:result.canAutoAccept,canPersist:result.canPersist};
  });
  expect(r.raw).toEqual(['Account','0007']);
  expect(new Set(r.ids).size).toBe(2);
  expect(r.issues).toEqual([]);
  expect(r.canAutoAccept).toBe(false);
  expect(r.canPersist).toBe(false);
});
