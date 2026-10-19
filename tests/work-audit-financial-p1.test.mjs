import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualLedgerFixture} from './fixtures/portfolio-visual-ledger.mjs';
import {rowBindingFixture} from './fixtures/visual-row-binding.mjs';
import {extractVisualPortfolio,extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';

function view(original,newText) {
  const f=visualLedgerFixture();
  const q=f.source.observations.find(o=>o.raw===original);
  assert.ok(q,'fixture observation '+original);
  q.raw=newText;return f.source;
}
function assertBlocked(source,field) {
  const r=extractVisualPortfolioCorroborated(source,structuredClone(source));
  assert.equal(r.candidates.some(c=>c.fields.name.value==='Quartz Devices'),false);
  assert.equal(r.reconciliation.status,'not-evaluable');
  assert.ok(r.unresolved.some(u=>
    u.field===field || /AMBIGUOUS_QUANTITY|UNCERTAIN_QUANTITY|UNPAIRED_MARKET_VALUE/.test(u.reason)),
    'unresolved source field not captured');
  assert.equal(r.canPersist,false);
}
test('Work AIE-02: signed quantities cannot be converted to long positions',()=>{
 for(const v of ['-4 kpl','−4 kpl','- 4 kpl','+4 kpl','(4) kpl'])
  assertBlocked(view('4 kpl',v),'quantity');
});
test('Work AIE-03: all quantity observations count, even invalid/ambiguous/zero second token',()=>{
 for(const v of ['4 kpl 1,234 kpl','4 kpl 0 kpl','4 kpl -9 kpl',
  '4 kpl 99 kpl','4 kpl 1 2 kpl'])
  assertBlocked(view('4 kpl',v),'quantity');
});
test('Work AIE-02: negative, accounting, and malformed market money cannot turn positive',()=>{
 for(const value of ['- 101,25 EUR','−101,25 EUR','(101,25 EUR)',
   '1 01,25 EUR']) {
   const r=extractVisualPortfolio(view('101,25 EUR',value));
   const quartz=r.candidates.find(c=>c.fields.name.value==='Quartz Devices');
   assert.ok(!quartz || quartz.fields.marketValue.value===null,
     'do not propose number suffix from '+value);
   assert.equal(r.reconciliation.status,'not-evaluable');
   assert.equal(r.canPersist,false);
 }
});
test('P1 controls: intact positive quantities and valid groupings remain useful',()=>{
 const clean=extractVisualPortfolio(visualLedgerFixture().source);
 assert.equal(clean.candidates.length,5);
 assert.equal(clean.reconciliation.status,'pass');
 const group=extractVisualPortfolio(view('101,25 EUR','1 101,25 EUR'));
 assert.equal(group.candidates[0].fields.marketValue.value.cents,110125);
 assert.equal(group.reconciliation.status,'mismatch');
});

test('valid 0,00 EUR cash supports a true arithmetic PASS; zero long quantity does not',()=>{
 const good=extractVisualPortfolio(rowBindingFixture({attack:false}).source);
 assert.equal(good.candidates.length,4);
 assert.equal(good.reconciliation.status,'pass');
 const bad=extractVisualPortfolio(view('4 kpl','0 kpl'));
 assert.equal(bad.candidates.some(c=>c.fields.name.value==='Quartz Devices'),false);
 assert.equal(bad.reconciliation.status,'not-evaluable');
});
