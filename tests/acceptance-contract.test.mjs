import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateImportCandidate} from '../src/acceptance.mjs';

function payroll(){
 const entries=[
  ['payDate','2026-10-13'],['grossPay',3200],['netPay',2450],['ytdTaxableIncome',42000],
  ['withholdingPeriod',750]
 ];
 return {app:'palkka',documentType:'payslip',fields:Object.fromEntries(entries.map(([k,v],i)=>[k,{status:'verified',value:v,sourceIds:['p'+(i+1)]}])),
   observations:entries.map(([k,v],i)=>({id:'p'+(i+1),raw:String(v),material:true,page:1,box:{x0:0,y0:i/8}})),
   issues:[],accountedEvidenceIds:[]};
}
function holdings(){
 const entries=[['ticker','NOKIA'],['quantity',10],['buyPrice',0],['currency','EUR'],['broker','Nordnet']];
 return {app:'osakevahti',documentType:'holdings',
   fields:Object.fromEntries(entries.map(([k,v],i)=>[k,{status:'verified',value:v,sourceIds:['c'+i]}])),
   observations:entries.map(([k,v],i)=>({id:'c'+i,raw:String(v),material:true,row:2,column:i+1})),
   issues:[],accountedEvidenceIds:[]};
}
const withIssue=(data,change)=>{let c=structuredClone(data);change(c);return evaluateImportCandidate(c)};
const has=(result,code)=>result.problems.some(p=>p.code===code);
test('candidate-ready still never grants saving permission',()=>{
 const r=evaluateImportCandidate(payroll());
 assert.equal(r.status,'candidate-ready');assert.equal(r.canPersist,false);
});
test('holdings: zero buy price is distinct from missing',()=>{
 assert.equal(evaluateImportCandidate(holdings()).status,'candidate-ready');
 const r=withIssue(holdings(),c=>{c.fields.buyPrice.value=null;c.fields.buyPrice.status='missing'});
 assert.ok(has(r,'MISSING_FIELD'));assert.equal(r.canAutoAccept,false);
});
test('salary: missing net blocks',()=>assert.ok(has(withIssue(payroll(),c=>{delete c.fields.netPay;}),'MISSING_FIELD')));
test('salary: invalid pay date blocks',()=>assert.ok(has(withIssue(payroll(),c=>{c.fields.payDate.value='2026-02-30';}),'INVALID_FIELD')));
test('salary: net exceeds gross blocks',()=>assert.ok(has(withIssue(payroll(),c=>{c.fields.netPay.value=3300;}),'NET_EXCEEDS_GROSS')));
test('different YTD values conflict even with confidence 0.99',()=>{
 const r=withIssue(payroll(),c=>{c.fields.ytdTaxableIncome.status='conflict';c.fields.ytdTaxableIncome.confidence=.99;});
 assert.ok(has(r,'CONFLICT'));
});
test('cannot present source-free guessed value as verified',()=>assert.ok(has(withIssue(payroll(),c=>{c.fields.grossPay.sourceIds=[];}),'MISSING_SOURCE_EVIDENCE')));
test('fake source id cannot be used to pass safety checks',()=>assert.ok(has(withIssue(payroll(),c=>{c.fields.grossPay.sourceIds=['does-not-exist'];}),'BAD_SOURCE_REFERENCE')));
test('unaccounted material amount blocks despite all required fields present',()=>assert.ok(has(withIssue(payroll(),c=>{c.observations.push({id:'extra',raw:'43 000,00',material:true,page:2});}),'UNACCOUNTED_MATERIAL')));
test('nonmaterial title text need not be mapped',()=>{
 const r=withIssue(payroll(),c=>{c.observations.push({id:'title',raw:'Palkkalaskelma',material:false});});
 assert.equal(r.status,'candidate-ready');
});
test('blocking notice from an optional field blocks',()=>assert.ok(has(withIssue(payroll(),c=>{c.issues.push({level:'blocking',code:'ytd-withholding-conflict'});}),'BLOCKING_SOURCE_ISSUE')));
test('unknown notice severity fails closed',()=>assert.ok(has(withIssue(payroll(),c=>{c.issues.push({code:'undefined-source'});}),'BLOCKING_SOURCE_ISSUE')));
test('info notices may be retained without blocking',()=>{
 const r=withIssue(payroll(),c=>{c.issues.push({level:'info',code:'source-has-optional-data'});});
 assert.equal(r.status,'candidate-ready');
});
test('holdings need an instrument ID and do not infer account type from broker',()=>{
 const r=withIssue(holdings(),c=>{delete c.fields.ticker;});
 assert.ok(has(r,'NO_INSTRUMENT_ID'));
 assert.equal(holdings().fields.accountType,undefined);
});
test('holdings require positive quantity and explicit currency',()=>{
 assert.ok(has(withIssue(holdings(),c=>{c.fields.quantity.value=0;}),'INVALID_FIELD'));
 assert.ok(has(withIssue(holdings(),c=>{c.fields.currency.value='';c.fields.currency.status='missing';}),'MISSING_FIELD'));
});
test('unknown populated CSV column is not dropped',()=>assert.ok(has(withIssue(holdings(),c=>{c.observations.push({id:'unknown',raw:'not-ignored',material:true,column:7});}),'UNACCOUNTED_MATERIAL')));
test('invalid or duplicate raw observation IDs fail closed',()=>assert.ok(has(withIssue(payroll(),c=>{c.observations.push({id:'p1',raw:'duplicate',material:true});}),'INVALID_SOURCE_OBSERVATION')));
test('accounted ID must exist in raw observations',()=>assert.ok(has(withIssue(payroll(),c=>{c.accountedEvidenceIds=['fake'];}),'BAD_SOURCE_REFERENCE')));
test('unknown app or doc type blocks',()=>{
 assert.ok(has(withIssue(payroll(),c=>{c.documentType='unknown';}),'UNKNOWN_DOCUMENT_TYPE'));
 assert.equal(evaluateImportCandidate({app:'something-else'}).canPersist,false);
});
