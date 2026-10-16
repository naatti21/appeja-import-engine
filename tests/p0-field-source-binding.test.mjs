// P0 evidence attribution: a source ID must not make unrelated material vanish.
// All inputs are synthetic; the acceptance gate remains read-only/canPersist=false.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateImportCandidate} from '../src/acceptance.mjs';

function payroll() {
  const entries=[
    ['payDate','2026-10-13'],['grossPay',3200],['netPay',2450],
    ['ytdTaxableIncome',42000]
  ];
  return {app:'palkka',documentType:'payslip',issues:[],accountedEvidenceIds:[],
    fields:Object.fromEntries(entries.map(([key,value],i)=>
      [key,{value,status:'verified',sourceIds:['s'+i]}])),
    observations:entries.map(([key,value],i)=>({
      id:'s'+i,raw:String(value),page:1,material:true
    }))
  };
}
function holdings() {
  const entries=[['ticker','NOKIA'],['quantity',10],['buyPrice',5.25],['currency','EUR']];
  return {app:'osakevahti',documentType:'holdings',issues:[],accountedEvidenceIds:[],
    fields:Object.fromEntries(entries.map(([key,value],i)=>
      [key,{value,status:'verified',sourceIds:['h'+i]}])),
    observations:entries.map(([key,value],i)=>({
      id:'h'+i,raw:String(value),row:2,column:i+1,material:true
    }))
  };
}
function forged(c,key,id,raw,meta={}) {
  c.observations.push({id,raw,material:true,...meta});
  c.fields[key].sourceIds.push(id);
  return evaluateImportCandidate(c);
}
function assertMismatch(r,key,id) {
  assert.equal(r.status,'review-required');
  assert.equal(r.canAutoAccept,false);
  assert.equal(r.canPersist,false);
  assert.ok(r.problems.some(p=>p.code==='SOURCE_VALUE_MISMATCH'&&p.field===key&&p.detail===id),
    'Wrong raw value must not substantiate the field: '+key+'/'+id);
  assert.ok(r.problems.some(p=>p.code==='UNACCOUNTED_MATERIAL'&&p.detail===id),
    'False field source must remain material and unresolved: '+id);
}
test('P0: unrelated second-page 43 000 amount cannot be laundered as gross 3 200',()=>{
  assertMismatch(forged(payroll(),'grossPay','foreign-money','43 000,00',{page:2}),
    'grossPay','foreign-money');
});
test('P0: different second-page pay date cannot be laundered through payDate sourceIds',()=>{
  assertMismatch(forged(payroll(),'payDate','wrong-date','Maksupäivä 14.10.2026',{page:2}),
    'payDate','wrong-date');
});
test('P0: a different quantity cannot be used as proof of an existing quantity',()=>{
  assertMismatch(forged(holdings(),'quantity','foreign-qty','99',{row:3,column:2}),
    'quantity','foreign-qty');
});
test('P0: wrong currency code cannot be used as evidence for EUR',()=>{
  assertMismatch(forged(holdings(),'currency','foreign-currency','USD',{row:3,column:4}),
    'currency','foreign-currency');
});
test('control: legitimate Finnish-formatted numeric and date source strings remain acceptable',()=>{
  const c=payroll();
  c.observations[0].raw='Maksupäivä 13.10.2026';
  c.observations[1].raw='Kauden brutto 3 200,00';
  c.observations[2].raw='Maksetaan 2 450,00';
  c.observations[3].raw='Vuositulo 42 000,00';
  const r=evaluateImportCandidate(c);
  assert.equal(r.status,'candidate-ready');
  assert.equal(r.canPersist,false);
});
test('control: material verified currency, zero buy price and quantity stay valid',()=>{
  const c=holdings();
  c.fields.buyPrice.value=0;c.observations[2].raw='0';
  const r=evaluateImportCandidate(c);
  assert.equal(r.status,'candidate-ready');
  assert.equal(r.canPersist,false);
});
