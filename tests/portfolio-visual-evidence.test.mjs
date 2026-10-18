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


function repositionValueColumn(f,deltaPx) {
  const shift=deltaPx/f.width;
  for(const o of f.source.observations){
    if(o.source.box.x0>=.60){
      o.source.box.x0+=shift;o.source.box.x1+=shift;
      assert.ok(o.source.box.x0>=0&&o.source.box.x1<=1);
    }
  }
  for(const item of f.drawing)if(item.x>=500)item.x+=deltaPx;
  return f;
}
test('moved value/quantity column still yields five exact source-linked instruments',()=>{
 for(const offset of [-145,-95,-55,0]){
  const f=repositionValueColumn(visualLedgerFixture(),offset);
  const r=extractVisualPortfolio(f.source);
  assert.deepEqual(r.candidates.map(c=>({
    kind:c.kind,name:c.fields.name.value,qty:c.fields.quantity.value,
    cents:c.fields.marketValue.value?.cents
  })),f.oracle,'right column shifted '+offset+'px');
  assert.equal(r.reconciliation.status,'pass');
  assert.equal(r.canPersist,false);
  assert.ok(r.candidates.every(c=>c.marketVerification.status==='not-verified'));
 }
});
test('one nearby day-change amount must not masquerade as missing holding market value',()=>{
 const f=visualLedgerFixture({missingAmount:true});
 const original=f.source.observations.find(o=>o.raw==='Arbor Financial');
 const amountSource=structuredClone(original.source);
 amountSource.box={x0:505/f.width,x1:700/f.width,
    y0:original.source.box.y0-50/f.height,
    y1:original.source.box.y1-50/f.height};
 const labelSource=structuredClone(amountSource);
 labelSource.box.x0=65/f.width;labelSource.box.x1=320/f.width;
 f.source.observations.push({id:'synthetic-fake-daily-label',raw:'Arvonmuutos',
   ocrConfidence:99,source:labelSource});
 f.source.observations.push({id:'synthetic-fake-daily-amount',raw:'9,99 EUR',
   ocrConfidence:99,source:amountSource});
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.candidates[2].fields.marketValue.value,null);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.canPersist,false);
});


test('cross-reading restores one weak quantity only when another OCR read confirms same field',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 const primaryQty=f.source.observations.find(o=>o.raw==='4 kpl');
 assert.ok(primaryQty);
 primaryQty.ocrConfidence=32;
 const standalone=extractVisualPortfolio(f.source);
 assert.equal(standalone.candidates.length,4);
 const both=extractVisualPortfolioCorroborated(f.source,w);
 assert.equal(both.candidates.length,5);
 assert.equal(both.candidates[0].fields.name.value,'Quartz Devices');
 assert.equal(both.candidates[0].fields.quantity.value,4);
 assert.equal(both.candidates[0].canPersist,false);
 assert.equal(both.candidates[0].marketVerification.status,'not-verified');
 assert.equal(both.reconciliation.status,'pass');
});
test('cross-reading rejects a low-confidence matching field when BOTH OCR reads are weak',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 f.source.observations.find(o=>o.raw==='4 kpl').ocrConfidence=25;
 w.observations.find(o=>o.raw==='4 kpl').ocrConfidence=18;
 const result=extractVisualPortfolioCorroborated(f.source,w);
 assert.equal(result.candidates.length,4);
 assert.ok(result.unresolved.some(x=>x.reason==='OCR_NAME_DISAGREEMENT'));
 assert.equal(result.reconciliation.status,'not-evaluable');
 assert.equal(result.canPersist,false);
});
test('different numeric quantities never combine across OCR reads, even when one is weak',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 f.source.observations.find(o=>o.raw==='4 kpl').ocrConfidence=25;
 w.observations.find(o=>o.raw==='4 kpl').raw='9 kpl';
 const result=extractVisualPortfolioCorroborated(f.source,w);
 assert.equal(result.candidates.length,4);
 assert.ok(!result.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
 assert.equal(result.reconciliation.status,'not-evaluable');
});
test('cross-reading with one weak market-value token but exact strong witness preserves source identity',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 f.source.observations.find(o=>o.raw==='101,25 EUR').ocrConfidence=18;
 const result=extractVisualPortfolioCorroborated(f.source,w);
 assert.equal(result.candidates.length,5);
 assert.equal(result.candidates[0].fields.marketValue.value.cents,10125);
 assert.equal(result.candidates[0].confidenceBasis,'exact-source-tokens-two-local-reads-at-least-one-strong-per-token');
 assert.equal(result.reconciliation.status,'pass');
 assert.ok(result.candidates.every(c=>!c.canPersist));
});
test('two matching but low-confidence names do not bypass field confidence gate',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 f.source.observations.find(o=>o.raw==='Quartz Devices').ocrConfidence=5;
 w.observations.find(o=>o.raw==='Quartz Devices').ocrConfidence=9;
 const result=extractVisualPortfolioCorroborated(f.source,w);
 assert.equal(result.candidates.length,4);
 assert.ok(!result.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
});

test('two language reads with complementary per-token confidence can recover a source-supported quantity',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 // The same fictional quantity is observed in both. Different word tokens
 // have confident coverage in different readings; neither pass is fully strong.
 const item=f.source.observations.find(o=>o.raw==='4 kpl');
 const alt=w.observations.find(o=>o.raw==='4 kpl');
 assert.ok(item&&alt);
 // This fixture represents a complete phrase as ONE token, so model the
 // complementary coverage in the actual word-split inline fixture separately.
 item.ocrConfidence=80;alt.ocrConfidence=41;
 const r=extractVisualPortfolioCorroborated(f.source,w);
 assert.ok(r.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
 assert.equal(r.canPersist,false);
});
test('independently same value but different raw token is withheld despite matching arithmetic',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 w.observations.find(o=>o.raw==='4 kpl').raw='04 kpl';
 const r=extractVisualPortfolioCorroborated(f.source,w);
 assert.ok(!r.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
 assert.equal(r.reconciliation.status,'not-evaluable');
});
test('a shifted or reused source token from a different row cannot corroborate quantity',()=>{
 const f=visualLedgerFixture(),w=structuredClone(f.source);
 const q=w.observations.find(o=>o.raw==='4 kpl');
 q.source.box.y0+=.10;q.source.box.y1+=.10;
 const r=extractVisualPortfolioCorroborated(f.source,w);
 assert.ok(!r.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
 assert.equal(r.canPersist,false);
});
