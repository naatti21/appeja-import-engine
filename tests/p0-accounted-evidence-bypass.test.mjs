// P0 negative tests: free-form accounting claims are NOT validation evidence.
// Entirely synthetic payroll data; no app storage, networking or real user records.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateImportCandidate} from '../src/acceptance.mjs';

function baseline() {
  const entries=[
    ['payDate','2026-10-13'],['grossPay',3200],['netPay',2450],
    ['ytdTaxableIncome',42000]
  ];
  return {
    app:'palkka',documentType:'payslip',
    fields:Object.fromEntries(entries.map(([key,value],i)=>[
      key,{status:'verified',value,sourceIds:['f'+i]}])),
    observations:entries.map(([key,value],i)=>({
      id:'f'+i,raw:String(value),material:true,page:1,
      box:{x0:0,y0:i/8}})),
    issues:[],accountedEvidenceIds:[]
  };
}
const has=(r,code,detail)=>r.problems.some(p=>p.code===code &&
  (detail===undefined||p.detail===detail));

test('P0: forged accounting acknowledgement cannot hide an unmatched second-page amount',()=>{
  const c=baseline();
  c.observations.push({id:'unexplained',raw:'43 000,00',material:true,page:2});
  c.accountedEvidenceIds=['unexplained']; // Existing valid ID but no independently checked field.
  const r=evaluateImportCandidate(c);
  assert.equal(r.status,'review-required');
  assert.equal(r.canAutoAccept,false);
  assert.equal(r.canPersist,false);
  assert.ok(has(r,'UNACCOUNTED_MATERIAL','unexplained'),
    'Unverified ledger claim must not suppress unexplained material evidence');
});

test('P0 control: verified required fields alone still form a non-persisting candidate',()=>{
  const r=evaluateImportCandidate(baseline());
  assert.equal(r.status,'candidate-ready');
  assert.equal(r.canAutoAccept,true);
  assert.equal(r.canPersist,false);
});

test('P0 control: a nonmaterial title does not create a blocking material omission',()=>{
  const c=baseline();
  c.observations.push({id:'title',raw:'Palkkalaskelma',material:false,page:1});
  c.accountedEvidenceIds=['title'];
  const r=evaluateImportCandidate(c);
  assert.equal(r.status,'candidate-ready');
  assert.equal(r.canPersist,false);
});

test('P0 control: fabricated non-existent accounting ID is still rejected',()=>{
  const c=baseline();
  c.accountedEvidenceIds=['not-in-observations'];
  const r=evaluateImportCandidate(c);
  assert.ok(has(r,'BAD_SOURCE_REFERENCE','not-in-observations'));
  assert.equal(r.canAutoAccept,false);
});
