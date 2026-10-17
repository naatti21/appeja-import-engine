import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReviewDraft,correctReviewField,reviewFieldSources,reviewDiagnostics} from '../src/review-draft.mjs';
const evidence=(kind='image-ocr-tsv')=>({schemaVersion:1,sourceKind:kind,issues:[],observations:[
  {id:'w1',raw:'Aurora Robotics',source:{format:kind,page:1,box:{x0:.1,y0:.1,x1:.3,y1:.2}}},
  {id:'w2',raw:'7',source:{format:kind,page:1,box:{x0:.5,y0:.1,x1:.6,y1:.2}}},
  {id:'w3',raw:'unused name',source:{format:kind,page:1,box:{x0:.1,y0:.8,x1:.3,y1:.9}}}
]});
const holding={id:'record-1',fields:{name:{value:'Aurora Robotics',status:'candidate',sourceIds:['w1']},quantity:{value:7,status:'candidate',sourceIds:['w2']}}};
test('holdings OCR preview is always non-persistent and keeps source positions',()=>{
 const source=evidence(),draft=createReviewDraft({documentType:'holdings',source,records:[holding]});
 assert.equal(draft.canPersist,false);assert.equal(draft.status,'review-required');
 assert.equal(draft.problems.length,0);
 assert.deepEqual(reviewFieldSources(draft,'record-1','quantity'),[source.observations[1]]);
 assert.deepEqual(reviewDiagnostics(draft),{recordCount:1,fieldCount:2,correctedCount:0,problemCount:0,canPersist:false});
});
test('payroll PDF preview shares the envelope without holdings concepts',()=>{
 const source={schemaVersion:1,sourceKind:'pdf',issues:[],observations:[
  {id:'p1',raw:'17.10.2026',source:{format:'pdf',page:1}},
  {id:'p2',raw:'3 200,00',source:{format:'pdf',page:1}}
 ]};
 const draft=createReviewDraft({documentType:'payroll',source,records:[{id:'payslip-1',fields:{
  payDate:{value:'2026-10-17',status:'candidate',sourceIds:['p1']},
  grossPay:{value:3200,status:'candidate',sourceIds:['p2']},
  netPay:{value:null,status:'missing',sourceIds:[]}
 }}]});
 assert.equal(draft.canPersist,false);assert.equal(draft.records[0].fields.netPay.value,null);
 assert.equal(draft.problems.length,0);
});
test('forged sources and missing proof cannot count as trustworthy candidates',()=>{
 const draft=createReviewDraft({documentType:'holdings',source:evidence(),records:[{id:'r',fields:{
  quantity:{value:77,status:'verified',sourceIds:['fake-id']},
  currency:{value:'EUR',status:'verified',sourceIds:[]}
 }}]});
 assert.deepEqual(draft.problems.map(p=>p.code).sort(),[
  'BAD_SOURCE_REFERENCE','MISSING_FIELD_PROVENANCE','MISSING_FIELD_PROVENANCE'
 ]);
 assert.equal(draft.canPersist,false);
});
test('manual correction needs explicit confirmation and preserves observed value',()=>{
 const input=createReviewDraft({documentType:'holdings',source:evidence(),records:[holding]});
 assert.throws(()=>correctReviewField(input,{recordId:'record-1',fieldName:'quantity',value:9}),/EXPLICIT/);
 const corrected=correctReviewField(input,{recordId:'record-1',fieldName:'quantity',value:9,confirmed:true});
 assert.equal(corrected.records[0].fields.quantity.value,9);
 assert.equal(corrected.records[0].fields.quantity.suggestedValue,7);
 assert.equal(input.records[0].fields.quantity.value,7);
 assert.equal(corrected.source.observations[1].raw,'7');
 assert.equal(corrected.canPersist,false);
 assert.equal(reviewDiagnostics(corrected).correctedCount,1);
});
test('duplicate evidence, duplicate record IDs and wrong data types are rejected',()=>{
 assert.throws(()=>createReviewDraft({documentType:'x',source:{...evidence(),observations:[evidence().observations[0],evidence().observations[0]]},records:[holding]}),/DUPLICATE_OBSERVATION/);
 assert.throws(()=>createReviewDraft({documentType:'x',source:evidence(),records:[holding,holding]}),/DUPLICATE_REVIEW_RECORD/);
 assert.throws(()=>createReviewDraft({documentType:'x',source:evidence(),records:[{id:'r',fields:{price:{value:Infinity,status:'candidate',sourceIds:['w2']}}}]}),/INVALID_REVIEW_FIELD/);
});
test('diagnostics never leak prices, amounts or OCR source text',()=>{
 const source=evidence();const draft=createReviewDraft({documentType:'holdings',source,records:[holding]});
 const report=JSON.stringify(reviewDiagnostics(draft));
 assert.ok(!report.includes('Aurora'));assert.ok(!report.includes('7'));assert.ok(!report.includes('w1'));
});
test('existing CSV evidence and holdings adapter can feed the same review contract',async()=>{
 const {evidenceFromDelimited}=await import('../src/import-observations.mjs');
 const {parseHoldingsCsv}=await import('../src/holdings.mjs');
 const csv='Nimi;Määrä;Hankintahinta;Valuutta\nAurora Robotics;7;12,50;EUR';
 const source=evidenceFromDelimited(csv),candidate=parseHoldingsCsv(csv);
 const fromAdapter=candidate.records[0].fields;
 const fields=Object.fromEntries(Object.entries(fromAdapter).map(([key,field])=>[key,{
  value:field.value,status:field.status==='valid'?'candidate':field.status,
  sourceIds:field.observationId?[field.observationId]:[]
 }]));
 const draft=createReviewDraft({documentType:'holdings',source,records:[{id:'csv-row-2',fields}]});
 assert.equal(draft.problems.length,0);
 assert.equal(draft.records[0].fields.quantity.value,7);
 assert.equal(reviewFieldSources(draft,'csv-row-2','buyPrice')[0].raw,'12,50');
 assert.equal(draft.canPersist,false);
});
test('existing PDF layout evidence reader can feed payroll review without leaking content in diagnostics',async()=>{
 const {evidenceFromPdfLayout}=await import('../src/import-observations.mjs');
 const source=evidenceFromPdfLayout({observations:[
  {id:'pdf-p1-1',raw:'Palkkapäivä 17.10.2026',page:1,box:{x0:.1,y0:.1,x1:.3,y1:.12},method:'pdfjs'},
  {id:'pdf-p1-2',raw:'3 200,00',page:1,box:{x0:.1,y0:.2,x1:.3,y1:.23},method:'pdfjs'}
 ],issues:[]});
 const draft=createReviewDraft({documentType:'payroll',source,records:[{id:'pay-1',fields:{
  payDate:{value:'2026-10-17',status:'candidate',sourceIds:['pdf-p1-1']},
  grossPay:{value:3200,status:'candidate',sourceIds:['pdf-p1-2']}
 }}]});
 assert.equal(reviewFieldSources(draft,'pay-1','grossPay')[0].source.format,'pdf');
 assert.equal(draft.canPersist,false);
 assert.equal(JSON.stringify(reviewDiagnostics(draft)).includes('3 200'),false);
});
