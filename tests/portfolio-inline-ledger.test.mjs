import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractVisualPortfolio} from '../src/portfolio-visual-evidence.mjs';
import {inlineLedgerFixture} from './fixtures/portfolio-inline-ledger.mjs';

test('compact same-line amount and kpl are distinct fields with unique source IDs',()=>{
 const f=inlineLedgerFixture(),r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,4);
 assert.deepEqual(r.candidates.map(c=>({
  name:c.fields.name.value,kind:c.kind,
  quantity:c.fields.quantity.value,cents:c.fields.marketValue.value?.cents
 })),f.oracle);
 assert.equal(r.reconciliation.status,'pass');
 for(const c of r.candidates){
  assert.deepEqual(c.fields.marketValue.sourceIds.length,2);
  assert.deepEqual(c.fields.quantity.sourceIds.length,2);
  assert.ok(c.fields.marketValue.sourceIds.every(id=>!c.fields.quantity.sourceIds.includes(id)));
  assert.equal(c.canPersist,false);
  assert.equal(c.marketVerification.status,'not-verified');
 }
});
test('same line with two plausible money amounts must not guess market value',()=>{
 const r=extractVisualPortfolio(inlineLedgerFixture({dualMoney:true}).source);
 assert.equal(r.candidates.length,4);
 assert.equal(r.candidates[1].fields.marketValue.status,'missing');
 assert.equal(r.candidates[1].fields.marketValue.value,null);
 assert.equal(r.reconciliation.status,'not-evaluable');
});
test('same-line day-change label cannot be mistaken for market value',()=>{
 const r=extractVisualPortfolio(inlineLedgerFixture({changeTag:true}).source);
 assert.equal(r.candidates.length,4);
 assert.equal(r.candidates[1].fields.marketValue.value,null);
 assert.equal(r.reconciliation.status,'not-evaluable');
});
test('cropped compact row works without totals and still requires human approval',()=>{
 const r=extractVisualPortfolio(inlineLedgerFixture({noSummary:true}).source);
 assert.equal(r.candidates.length,4);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.canPersist,false);
 assert.equal(r.requiresUserApproval,true);
});
