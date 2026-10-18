import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractVisualPortfolio,extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';
import {visualLedgerFixture} from './fixtures/portfolio-visual-ledger.mjs';

test('full untrimmed mobile source: four stocks + one wrapped fund; no UI text becomes holding',()=>{
 const f=visualLedgerFixture(),r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,5);
 assert.deepEqual(r.candidates.map(c=>({
  kind:c.kind,name:c.fields.name.value,qty:c.fields.quantity.value,
  cents:c.fields.marketValue.value?.cents
 })),f.oracle);
 assert.equal(r.unresolved.length,0);
 assert.deepEqual(r.candidates.map(c=>c.marketVerification.status),Array(5).fill('not-verified'));
 assert.ok(r.candidates.every(c=>c.fields.purchasePrice.value===null&&!c.canPersist));
 for(const c of r.candidates)for(const field of Object.values(c.fields))
  for(const id of field.sourceIds)assert.ok(f.source.observations.some(o=>o.id===id));
});
test('cash + visible stock + fund market values match exactly in integer cents',()=>{
 const r=extractVisualPortfolio(visualLedgerFixture().source);
 assert.equal(r.reconciliation.status,'pass');
 assert.equal(r.reconciliation.visibleHoldingsCents,151660);
 assert.equal(r.reconciliation.cashCents,1340);
 assert.equal(r.reconciliation.reportedTotalCents,153000);
 assert.equal(r.reconciliation.differenceCents,0);
 assert.equal(r.reconciliation.marketIdentityVerified,false);
 assert.equal(r.reconciliation.completenessProven,false);
 assert.equal(r.reconciliation.canPersist,false);
 assert.ok(r.reconciliation.sourceIds.length>5);
});
test('a one-cent mismatch is detected without inventing omitted holdings',()=>{
 const r=extractVisualPortfolio(visualLedgerFixture({wrongTotal:true}).source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'mismatch');
 assert.equal(r.reconciliation.differenceCents,-1);
});
test('user crop remains accepted; missing summary means arithmetic is not evaluable',()=>{
 const r=extractVisualPortfolio(visualLedgerFixture({crop:true}).source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.canPersist,false);
});
test('do not reconcile incomplete or mixed-currency financial observations',()=>{
 const incomplete=extractVisualPortfolio(visualLedgerFixture({missingAmount:true}).source);
 assert.equal(incomplete.candidates.length,5);
 assert.equal(incomplete.candidates[2].fields.marketValue.status,'missing');
 assert.equal(incomplete.reconciliation.status,'not-evaluable');
 const mixed=extractVisualPortfolio(visualLedgerFixture({mixedCurrency:true}).source);
 assert.equal(mixed.candidates.length,5);
 assert.equal(mixed.reconciliation.status,'not-evaluable');
 assert.equal(mixed.reconciliation.reason,'MIXED_CURRENCIES');
});
test('low-confidence name must not turn into a confident holding',()=>{
 const r=extractVisualPortfolio(visualLedgerFixture({weakName:true}).source);
 assert.equal(r.candidates.length,4);
 assert.ok(r.unresolved.some(u=>u.reason==='UNRESOLVED_INSTRUMENT_NAME'));
 assert.equal(r.reconciliation.status,'not-evaluable');
});
test('reject duplicate source IDs and forged geometry; never return holdings',()=>{
 for(const mutate of [
  o=>o[1].id=o[0].id,
  o=>o[0].source.box.x1=1.7,
  o=>o[0].source.box.y0=-.1
 ]){
  const f=visualLedgerFixture();mutate(f.source.observations);
  const r=extractVisualPortfolio(f.source);
  assert.equal(r.candidates.length,0);
  assert.equal(r.reconciliation.status,'not-evaluable');
  assert.equal(r.canPersist,false);
 }
});
test('blocking upstream OCR issues prevent speculative recovery',()=>{
 const f=visualLedgerFixture();f.source.issues=[{level:'blocking',code:'UNKNOWN_DOCUMENT'}];
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,0);
});

test('different current-source name readings block candidate even when cents all reconcile',()=>{
 const f=visualLedgerFixture();
 const witness=structuredClone(f.source);
 witness.observations.find(o=>o.raw==='Quartz Devices').raw='Ouartz Devices';
 const r=extractVisualPortfolioCorroborated(f.source,witness);
 assert.equal(r.candidates.length,4);
 assert.equal(r.unresolved.filter(x=>x.reason==='OCR_NAME_DISAGREEMENT').length,1);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.canPersist,false);
 assert.ok(r.candidates.every(c=>c.ocrNameAgreement==='two-local-language-reads'));
});
test('two identical source readings maintain five unverified candidates and exact arithmetic',()=>{
 const f=visualLedgerFixture(),r=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'pass');
 assert.ok(r.candidates.every(c=>c.marketVerification.status==='not-verified'));
});
