import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
test.skip(process.env.QA_CORPUS_READY!=='1','Needs independent 60-case generator.');
test.setTimeout(210000);

const ORACLE_FIELDS=['row_id','account','name','currency',
 'quantity','current_price','current_value','purchase_price'];
const badHeaders=new Set(['duplicate_column','unknown_money']);
const badValues=new Map([
 ['missing_cost','purchase_price'],
 ['missing_currency','currency'],
 ['missing_quantity','quantity'],
 ['ambiguous_decimal','current_price'],
 ['malformed_number','quantity'],
 ['conflicting_value','current_value']
]);
const parseKnown=v=>{
 if(v===null)return null;
 if(['','null'].includes(String(v)))return null;
 return Number.isFinite(Number(v))?Number(v):String(v);
};
test('QA v1.3 generated 60 native PDFs: independent cell oracle and fail-closed field provenance',async({page})=>{
 await page.goto('/demo/');
 const root='qa-output/corpus';
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 expect(manifest).toHaveLength(60);
 const counts={sources:0,rows:0,cleanRows:0,correctKnownFields:0,
  expectedKnownFields:0,correctNegativeBlocks:0,negativeTotal:0,sourceIdsVerified:0,
  unmatchedOrWrong:[]};
 for(const item of manifest){
  const path=join(root,item.case_id);
  const oracle=JSON.parse(await readFile(join(path,'oracle.json'),'utf8'));
  const bytes=await readFile(join(path,'source.pdf'));
  const actual=await page.evaluate(async payload=>{
   const pdfjs=await import('/demo/vendor/pdfjs/pdf.min.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='/demo/vendor/pdfjs/pdf.worker.min.mjs';
   const {readPdfWithPdfJs}=await import('/src/layout.mjs');
   const {evidenceFromPdfLayout}=await import('/src/import-observations.mjs');
   const {resolvePositionedHoldings}=await import('/src/positioned-holdings.mjs');
   const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(payload));
   const evidence=evidenceFromPdfLayout(layout);
   const r=resolvePositionedHoldings(evidence);
   const ids=new Set(evidence.observations.map(o=>o.id));
   return {rows:r.rows,problems:r.problems.map(x=>x.code),canPersist:r.canPersist,
    validIds:r.rows.every(row=>Object.values(row.fields).every(field=>
      field.sourceIds.every(id=>ids.has(id)))),
    observations:evidence.observations.length};
  },Array.from(bytes));
  counts.sources++;
  const replay='case='+item.case_id+' seed='+item.seed+' scenario='+item.scenario;
  expect(actual.canPersist,replay+' must not save').toBe(false);
  expect(actual.validIds,replay+' broken provenance').toBe(true);
  expect(actual.observations,replay+' no pdf observations').toBeGreaterThan(5);
  if(badHeaders.has(item.scenario)){
   expect(actual.rows.length,replay+' unsupported table must NOT be interpreted').toBe(0);
   expect(actual.problems,replay+' unmapped/duplicate header blocker')
    .toContain(item.scenario==='duplicate_column'?'DUPLICATE_SEMANTIC_HEADER':'UNKNOWN_OR_UNMAPPED_HEADER');
   counts.correctNegativeBlocks++;counts.negativeTotal++;
   continue;
  }
  expect(actual.rows.length,replay+' spatial rows').toBe(oracle.rows.length);
  const found=new Map(actual.rows.map(row=>[row.fields.row_id.value,row]));
  for(const expected of oracle.rows){
   const row=found.get(expected.row_id);
   expect(row,replay+' row '+expected.row_id+' absent').toBeTruthy();
   counts.rows++;
   for(const key of ORACLE_FIELDS){
    const f=row.fields[key],expectedValue=expected[key];
    if(expectedValue===null){
     if(item.scenario==='conflicting_value'&&key==='current_value'){
      expect(row.problems.map(p=>p.code),replay+' conflict not detected')
       .toContain('VALUE_PRICE_QUANTITY_CONFLICT');
     }else expect(f.status,replay+' unexpectedly accepted '+key).not.toBe('candidate');
     continue;
    }
    counts.expectedKnownFields++;
    const value=parseKnown(expectedValue);
    if(f.status==='candidate'&&String(f.value)===String(value))counts.correctKnownFields++;
    else counts.unmatchedOrWrong.push({case:item.case_id,row:expected.row_id,key,
      wanted:value,received:f.value,status:f.status});
    expect(f.status,replay+' '+key+' status').toBe('candidate');
    expect(f.value,replay+' '+key+' value').toEqual(value);
    expect(f.sourceIds.length,replay+' '+key+' sources').toBeGreaterThan(0);
    counts.sourceIdsVerified++;
   }
  }
  if(item.scenario==='clean'){
   expect(actual.problems,replay+' clean blockers').toEqual([]);
   counts.cleanRows+=actual.rows.length;
  }else {
   const blocker=badValues.get(item.scenario);
   if(blocker){
    expect(actual.problems.length,replay+' should require review').toBeGreaterThan(0);
    counts.correctNegativeBlocks++;counts.negativeTotal++;
   }
   if(item.scenario==='zero_quantity'){
    expect(actual.problems).toContain('NONPOSITIVE_QUANTITY');
    counts.correctNegativeBlocks++;counts.negativeTotal++;
   }
   if(item.scenario==='repeated_holding'){
    expect(actual.problems).toContain('REPEATED_HOLDING_NEEDS_REVIEW');
    counts.correctNegativeBlocks++;counts.negativeTotal++;
   }
  }
 }
 console.log('QA_V13_NATIVE_PDF_ORACLE '+JSON.stringify({...counts,
  falseAutoAccepted:0,validationScope:'PDF.js positional candidates (no persistence)'}));
 expect(counts.sources).toBe(60);
 expect(counts.correctKnownFields).toBe(counts.expectedKnownFields);
 expect(counts.unmatchedOrWrong).toEqual([]);
});
