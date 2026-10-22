import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOsakevahtiReview} from '../src/adapters/osakevahti-review.mjs';
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
   quantity:field(3.01,'units'),nav:field(182.86,'nav'),averageAcquisitionPrice:field(182.86,'nav')}
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
 assert.equal(JSON.stringify(result).includes('hello'),false);
});
