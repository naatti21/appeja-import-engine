import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOsakevahtiReview,createOsakevahtiFundSnapshotReview} from '../src/adapters/osakevahti-review.mjs';
import {createPalkkaReview} from '../src/adapters/palkka-review.mjs';
import {correctReviewField,reviewFieldSources,reviewDiagnostics} from '../src/review-draft.mjs';
const obs=(id,raw)=>({id,raw,method:'synthetic',source:{format:'image-ocr',page:1,
  box:{x0:.1,y0:.1,x1:.2,y1:.2}}});
const data=()=>({schemaVersion:1,sourceKind:'image-ocr-tsv',issues:[],observations:[
 obs('name','Nordnet Eurooppa Indeksi'),obs('units','3,01'),obs('nav','182,86'),
 obs('gav','160,02'),obs('value','550'),obs('date','21.10.2026')]});
const field=(value,id,role)=>({value,status:'verified',sourceIds:[id],role});
test('Nordnet fund: exact quantity, total value, NAV and GAV stay separate and nonpersistable',()=>{
 const source=data();
 const result=createOsakevahtiReview({source,documentRole:'CURRENT_HOLDINGS_SNAPSHOT',rows:[{
   id:'fund-1',fields:{name:field('Nordnet Eurooppa Indeksi','name'),
    quantity:field(3.01,'units'),value:field(550,'value'),nav:field(182.86,'nav'),
    averageAcquisitionPrice:field(160.02,'gav')}
 }]});
 assert.equal(result.canPersist,false);
 assert.equal(result.records[0].fields.quantity.status,'candidate');
 assert.equal(result.records[0].fields.nav.value,182.86);
 assert.equal(result.records[0].fields.averageAcquisitionPrice.value,160.02);
 assert.deepEqual(reviewFieldSources(result,'fund-1','averageAcquisitionPrice').map(o=>o.raw),['160,02']);
 const out=correctReviewField(result,{recordId:'fund-1',fieldName:'quantity',value:3.02,confirmed:true});
 assert.equal(out.records[0].fields.quantity.suggestedValue,3.01);
 assert.equal(out.source.observations[1].raw,'3,01');
 assert.equal(out.canPersist,false);
});
test('NAV cannot serve as cost basis even with a shared plausible numeric source',()=>{
 const result=createOsakevahtiReview({source:data(),documentRole:'CURRENT_HOLDINGS_SNAPSHOT',rows:[{
  id:'r',fields:{name:field('Nordnet Eurooppa Indeksi','name'),
   quantity:field(3.01,'units'),nav:field(182.86,'nav'),averageAcquisitionPrice:field(182.86,'nav','nav')}
 }]});
 assert.ok(result.problems.some(x=>x.code==='NAV_COST_SOURCE_COLLISION'));
 assert.ok(result.problems.some(x=>x.code==='FIELD_ROLE_CONFLICT'));
 assert.equal(result.records[0].fields.averageAcquisitionPrice.status,'conflict');
});
test('Unknown document role, missing name and quantity never become candidate-ready',()=>{
 const result=createOsakevahtiReview({source:data(),rows:[{id:'r',fields:{
   nav:field(182.86,'nav')}}]});
 assert.ok(result.problems.some(x=>x.code==='UNPROVEN_HOLDINGS_DOCUMENT_ROLE'));
 assert.equal(result.records[0].fields.quantity.status,'missing');
 assert.equal(result.records[0].fields.name.status,'missing');
 assert.equal(result.canPersist,false);
});
test('Palkka missing/contradictory fields force review, not Osakevahti field defaults',()=>{
 const source={schemaVersion:1,sourceKind:'pdf',issues:[],observations:[
   obs('day','28.8.2026'),obs('gross','4698,11'),obs('net','2678,39'),obs('ytd','63832,82')
 ]};
 const result=createPalkkaReview({source,parsed:{fields:{
  payDate:field('2026-08-28','day'),grossPay:field(4698.11,'gross'),
  netPay:field(2678.39,'net'),ytdTaxableIncome:{value:null,status:'conflict',sourceIds:['ytd']}
 },issues:[{code:'YTD_CONFLICT'}]}});
 assert.equal(result.documentType,'payroll');
 assert.equal(result.records[0].fields.ytdTaxableIncome.status,'conflict');
 assert.ok(result.problems.some(x=>x.code==='PAYROLL_PARSER_ISSUE'));
 assert.equal('quantity' in result.records[0].fields,false);
 assert.equal(result.canPersist,false);
});
test('Palkka source ref and user correction stay transient; diagnostics have no wages',()=>{
 const source={schemaVersion:1,sourceKind:'pdf',observations:[obs('day','28.8.2026'),
 obs('gross','4698,11'),obs('net','2678,39'),obs('ytd','63832,82')],issues:[]};
 const result=createPalkkaReview({source,parsed:{fields:{
  payDate:field('2026-08-28','day'),grossPay:field(4698.11,'gross'),
  netPay:field(2678.39,'net'),ytdTaxableIncome:field(63832.82,'ytd')
 }}});
 assert.equal(result.problems.length,0);
 assert.equal(result.records[0].fields.grossPay.status,'candidate');
 const edited=correctReviewField(result,{recordId:'payslip-1',fieldName:'netPay',value:2670,confirmed:true});
 assert.equal(edited.records[0].fields.netPay.reviewState,'user-corrected');
 assert.equal(result.records[0].fields.netPay.value,2678.39);
 const diag=JSON.stringify(reviewDiagnostics(edited));
 assert.equal(diag.includes('4698'),false);
 assert.equal(diag.includes('63832'),false);
 assert.equal(edited.canPersist,false);
});
test('No forged reference nor unknown domain field is accepted for financial evidence',()=>{
 const source=data();
 const result=createOsakevahtiReview({source,documentRole:'CURRENT_HOLDINGS_SNAPSHOT',
  rows:[{id:'r',fields:{name:field('Nordnet Eurooppa Indeksi','name'),
    quantity:field(3.01,'unrelated'),secretToken:field('hello','value')}}]});
 assert.ok(result.problems.some(x=>x.code==='BAD_SOURCE_REFERENCE'));
 assert.ok(result.problems.some(x=>x.code==='UNSUPPORTED_DOMAIN_FIELD'));
 assert.equal(JSON.stringify(result).includes('hello'),false);
});

test('Actual holdings CSV parser to source envelope to Osakevahti review preserves same source IDs',async()=>{
 const {parseHoldingsCsv}=await import('../src/holdings.mjs');
 const {evidenceFromDelimited}=await import('../src/import-observations.mjs');
 const csv='Nimi;Määrä;Hankintahinta;Valuutta\nExample Horizon Index;3,01;160,02;EUR';
 const source=evidenceFromDelimited(csv),parsed=parseHoldingsCsv(csv);
 const record=parsed.records[0];
 const fields=Object.fromEntries(Object.entries(record.fields).map(([key,v])=>[key,{
  value:v.value,status:v.status==='valid'?'candidate':v.status,
  sourceIds:v.observationId?[v.observationId]:[]
 }]));
 const draft=createOsakevahtiReview({source,documentRole:'PORTFOLIO_HOLDINGS',
  rows:[{id:'csv-holding-1',fields}]});
 assert.equal(draft.canPersist,false);
 assert.equal(draft.records[0].fields.quantity.value,3.01);
 assert.equal(draft.records[0].fields.buyPrice.value,160.02);
 assert.equal(reviewFieldSources(draft,'csv-holding-1','buyPrice')[0].raw,'160,02');
});
test('Actual structured payroll parser and PDF source envelope enter the same review shape',async()=>{
 const {layoutFromPdfItems}=await import('../src/layout.mjs');
 const {parsePayrollSections}=await import('../src/payroll-sections.mjs');
 const {evidenceFromPdfLayout}=await import('../src/import-observations.mjs');
 const lines=[
  'PALKKALASKELMA',
  'Palkkakausi 3.8.2026 - 16.8.2026',
  'Maksupäivä 28.8.2026',
  'Maksetaan 2 678,39',
  'KERTYMÄ PALKKAKAUDELTA',
  'Ennakonpid. al. tul 4 698,11',
  'Ennakonpidätys -1 526,89',
  'KERTYMÄ VUODEN ALUSTA',
  'Ennakonpid. al. tul 63 832,82',
  'Ennakonpidätys -18 792,51'
 ];
 const height=1000;
 const layout=layoutFromPdfItems([{width:1300,height,items:lines.map((str,i)=>({
  str,width:Math.min(1000,Math.max(80,str.length*7)),height:12,
  transform:[12,0,0,12,60,height-30-i*27]
 }))}]);
 const parsed=parsePayrollSections(layout);
 const source=evidenceFromPdfLayout(layout);
 const draft=createPalkkaReview({source,parsed});
 assert.equal(draft.documentType,'payroll');
 assert.equal(draft.records[0].fields.payDate.value,'2026-08-28');
 assert.equal(draft.records[0].fields.grossPay.value,4698.11);
 assert.equal(draft.records[0].fields.netPay.value,2678.39);
 assert.equal(draft.records[0].fields.ytdTaxableIncome.value,63832.82);
 assert.equal(draft.records[0].fields.grossPay.status,'candidate');
 assert.ok(reviewFieldSources(draft,'payslip-1','grossPay').length>0);
 assert.equal(draft.canPersist,false);
});

test('Real two-read compact fund snapshot flows to review without auto selecting a portfolio holding',async()=>{
 const {fundSnapshotFixture}=await import('./fixtures/fund-snapshots.mjs');
 const {extractFundSnapshot}=await import('../src/fund-snapshots.mjs');
 const fixture=fundSnapshotFixture('compact');
 const source={...fixture.source,schemaVersion:1,sourceKind:'image-ocr-tsv'};
 const snapshot=extractFundSnapshot(fixture.source,structuredClone(fixture.source));
 const review=createOsakevahtiFundSnapshotReview({source,snapshot});
 assert.equal(review.documentType,'holdings');
 assert.equal(review.canPersist,false);
 assert.equal(review.records.length,1);
 const f=review.records[0].fields;
 assert.equal(f.name.value,'Juniper Horizon Sustainable Index');
 assert.equal(f.quantity.value,'49.7');
 assert.equal(f.value.value,'1000.50');
 assert.equal(f.quantity.status,'candidate');
 assert.equal(f.nav.status,'missing');
 assert.equal(f.averageAcquisitionPrice.status,'missing');
 assert.equal('account' in f,false);
 assert.deepEqual(reviewFieldSources(review,review.records[0].id,'quantity').map(o=>o.raw),['49,7 kpl']);
});
test('Five actual fund cards preserve 4-decimal NAV vs acquisition cost and source provenance',async()=>{
 const {fundSnapshotFixture}=await import('./fixtures/fund-snapshots.mjs');
 const {extractFundSnapshot}=await import('../src/fund-snapshots.mjs');
 const fixture=fundSnapshotFixture('cards');
 const source={...fixture.source,schemaVersion:1,sourceKind:'image-ocr-tsv'};
 const result=extractFundSnapshot(fixture.source,structuredClone(fixture.source));
 const draft=createOsakevahtiFundSnapshotReview({source,snapshot:result});
 assert.equal(draft.records.length,5);
 assert.equal(draft.problems.length,0);
 for(const [i,row] of draft.records.entries()){
   assert.equal(row.fields.name.value,fixture.oracle[i].name);
   assert.equal(row.fields.quantity.value,fixture.oracle[i].quantity);
   assert.equal(row.fields.value.value,fixture.oracle[i].value);
   assert.equal(row.fields.nav.value,fixture.oracle[i].nav);
   assert.equal(row.fields.averageAcquisitionPrice.value,fixture.oracle[i].averageAcquisitionPrice);
   assert.equal(row.fields.currency.value,'EUR');
   assert.notEqual(row.fields.nav.sourceIds[0],row.fields.averageAcquisitionPrice.sourceIds[0]);
 }
 assert.equal(draft.canPersist,false);
});
test('Second OCR reading disagreement keeps same source but blocks candidate role',async()=>{
 const {fundSnapshotFixture}=await import('./fixtures/fund-snapshots.mjs');
 const {extractFundSnapshot}=await import('../src/fund-snapshots.mjs');
 const f=fundSnapshotFixture('compact'),w=structuredClone(f.source);
 w.observations.find(o=>o.raw==='49,7 kpl').raw='497 kpl';
 const result=extractFundSnapshot(f.source,w);
 const review=createOsakevahtiFundSnapshotReview({source:{...f.source,schemaVersion:1,sourceKind:'image-ocr-tsv'},snapshot:result});
 assert.equal(review.records[0].fields.quantity.status,'ambiguous');
 assert.equal(review.canPersist,false);
});
test('Swapped review evidence and forged fund identity fail closed',async()=>{
 const {fundSnapshotFixture}=await import('./fixtures/fund-snapshots.mjs');
 const {extractFundSnapshot}=await import('../src/fund-snapshots.mjs');
 const f=fundSnapshotFixture('compact');
 const snapshot=extractFundSnapshot(f.source,structuredClone(f.source));
 const swapped=structuredClone(f.source);swapped.observations.find(o=>o.raw==='49,7 kpl').raw='41,7 kpl';
 const review=createOsakevahtiFundSnapshotReview({source:{...swapped,schemaVersion:1,sourceKind:'image-ocr-tsv'},snapshot});
 assert.ok(review.problems.some(p=>p.code==='FUND_SNAPSHOT_SOURCE_MISMATCH'));
 assert.equal(review.records[0].fields.quantity.status,'conflict');
 const forged=structuredClone(snapshot);forged.rows[0].identityStatus='VERIFIED';
 assert.throws(()=>createOsakevahtiFundSnapshotReview({source:{...f.source,schemaVersion:1,sourceKind:'image-ocr-tsv'},snapshot:forged}),/INVALID_FUND_ROW_STATE/);
});
