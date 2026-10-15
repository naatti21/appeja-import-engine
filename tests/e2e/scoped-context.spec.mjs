import {test,expect} from '@playwright/test';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';

test('Y13 real Chromium PDF.js: column heading stays source-linked, never authorizes import',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async raw=>{
  const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
  const {fromPdfJsTextItems}=await import('/research/reader-bridge-v1/bridge.mjs');
  const {inspectScopedClaims}=await import('/research/scoped-context-v1/inspect.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(raw)});
  const pdf=await task.promise,pages=[];
  try{
   for(let i=1;i<=pdf.numPages;i++){
    const p=await pdf.getPage(i),viewport=p.getViewport({scale:1});
    pages.push({width:viewport.width,height:viewport.height,items:(await p.getTextContent()).items});
   }
  }finally{await task.destroy();}
  const layout=fromPdfJsTextItems(pages);
  const header=layout.observations.find(o=>o.raw==='Kertymä palkkakaudelta');
  const value=layout.observations.find(o=>o.raw==='3 200,00');
  if(!header||!value)return {error:'missing expected sources'};
  const fields={grossPay:{status:'verified',semanticKey:'grossPay',value:3200,
   sourceIds:[value.id,header.id],
   sourceRoles:{valueIds:[value.id],headerIds:[header.id],contextIds:[]},
   scopedRoles:{header:'column',context:'none'}}};
  const audit=inspectScopedClaims(layout,fields);
  const malicious=structuredClone(fields);
  malicious.grossPay.sourceIds.push('unverified-original-id');
  const rejected=inspectScopedClaims(layout,malicious);
  return {headerId:header.id,valueId:value.id,headerPage:header.page,valuePage:value.page,
   status:audit.status,scopeSupported:audit.scopeSupported,
   canAutoAccept:audit.canAutoAccept,canPersist:audit.canPersist,
   frozenBlocked:audit.frozenAudit?.canAutoAccept===false,
   forgedSupported:rejected.scopeSupported,issues:rejected.issues.map(x=>x.code)};
 },Array.from(syntheticPayrollPdf([{fullSlip:true}])));
 expect(result.error).toBeUndefined();
 expect(result.headerPage).toBe(1);expect(result.valuePage).toBe(1);
 expect(result.scopeSupported).toBe(true);
 expect(result.status).toBe('review-required');
 expect(result.canAutoAccept).toBe(false);expect(result.canPersist).toBe(false);
 expect(result.frozenBlocked).toBe(true);
 expect(result.forgedSupported).toBe(false);
 expect(result.issues).toContain('INVALID_OR_SURPLUS_SOURCE_IDS');
});
