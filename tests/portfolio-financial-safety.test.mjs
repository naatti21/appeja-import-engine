import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualLedgerFixture} from './fixtures/portfolio-visual-ledger.mjs';
import {inlineLedgerFixture} from './fixtures/portfolio-inline-ledger.mjs';
import {extractVisualPortfolio,extractVisualPortfolioCorroborated}
  from '../src/portfolio-visual-evidence.mjs';
const get=(f,text)=>{const w=f.source.observations.find(o=>o.raw===text);assert.ok(w,'fixture token '+text);return w;};
test('EU thousands separators must be parsed as the ENTIRE currency amount, not a matching suffix',()=>{
 for(const raw of ['1.101,25 EUR','1 101,25 EUR','1\u00a0101,25 EUR']){
  const f=visualLedgerFixture();get(f,'101,25 EUR').raw=raw;
  const r=extractVisualPortfolio(f.source);
  assert.equal(r.candidates.length,5);
  assert.equal(r.candidates[0].fields.marketValue.value.cents,110125,raw);
  assert.equal(r.reconciliation.status,'mismatch',raw);
  assert.equal(r.reconciliation.differenceCents,100000);
  assert.equal(r.canPersist,false);
 }
});
test('invalid or truncated currency token must never silently parse its numeric suffix',()=>{
 for(const invalid of ['1.10x,25 EUR','a101,25 EUR','1.101,25 EUR 30,00 EUR']){
  const f=visualLedgerFixture();get(f,'101,25 EUR').raw=invalid;
  const r=extractVisualPortfolio(f.source);
  assert.equal(r.reconciliation.status,'not-evaluable',invalid);
  assert.equal(r.candidates[0].fields.marketValue.value,null,invalid);
 }
});
test('two different quantity tokens on one row cannot be read as one holding quantity',()=>{
 for(const pair of ['4 kpl 40 kpl','4 pcs 40 pcs']){
  const f=visualLedgerFixture();get(f,'4 kpl').raw=pair;
  const r=extractVisualPortfolio(f.source);
  assert.ok(!r.candidates.some(c=>c.fields.name.value==='Quartz Devices'));
  assert.equal(r.reconciliation.status,'not-evaluable');
  assert.ok(r.unresolved.some(x=>x.reason==='AMBIGUOUS_QUANTITY'),pair);
 }
});
test('missing investment summary cannot be borrowed from a following savings account',()=>{
 const f=visualLedgerFixture();
 get(f,'Arvo yhteensä 1 530,00 EUR').raw='Arvo yhteensä';
 get(f,'Arvo yhteensä 2 550,00 EUR').raw='Arvo yhteensä 1 530,00 EUR';
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.reconciliation.reason,'MISSING_INDEPENDENT_TOTAL_OR_CASH');
});
test('duplicate portfolio totals must withhold PASS even if all numbers are equal',()=>{
 const f=visualLedgerFixture();
 const extra=structuredClone(get(f,'Arvo yhteensä 1 530,00 EUR'));
 extra.id='duplicate-investment-total';extra.source.box.y0+=.012;extra.source.box.y1+=.012;
 f.source.observations.push(extra);
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.equal(r.reconciliation.reason,'AMBIGUOUS_SUMMARY');
});
test('an unpaired holding market-value must make a coincidentally equal summary non-evaluable',()=>{
 const f=visualLedgerFixture();
 f.source.observations=f.source.observations.filter(o=>o.raw!=='4 kpl');
 get(f,'Arvo yhteensä 1 530,00 EUR').raw='Arvo yhteensä 1 428,75 EUR';
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,4);
 assert.equal(r.reconciliation.status,'not-evaluable');
 assert.ok(r.unresolved.some(x=>x.reason==='UNPAIRED_MARKET_VALUE'));
});
test('the daily-change amount does not become an unpaired holding valuation',()=>{
 const r=extractVisualPortfolio(visualLedgerFixture().source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'pass');
 assert.ok(!r.unresolved.some(x=>x.reason==='UNPAIRED_MARKET_VALUE'));
});
test('full-screen valid reference and cropped reference remain supported',()=>{
 const full=extractVisualPortfolio(visualLedgerFixture().source);
 const cropped=extractVisualPortfolio(visualLedgerFixture({crop:true}).source);
 assert.equal(full.reconciliation.status,'pass');
 assert.equal(cropped.reconciliation.status,'not-evaluable');
 assert.equal(cropped.candidates.length,5);
 assert.ok(full.candidates.every(c=>!c.canPersist));
});
test('the same invalid financial amount in two confident OCR passes cannot become valid by consensus',()=>{
 const f=visualLedgerFixture();get(f,'101,25 EUR').raw='1.10x,25 EUR';
 const result=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
 assert.equal(result.reconciliation.status,'not-evaluable');
 assert.ok(result.candidates.every(c=>!c.canPersist&&c.marketVerification.status==='not-verified'));
});
test('compact amount and quantity on same line remain separately source-bound',()=>{
 const f=inlineLedgerFixture(),r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,4);
 assert.equal(r.reconciliation.status,'pass');
 assert.ok(r.candidates.every(c=>c.fields.quantity.sourceIds.every(id=>!c.fields.marketValue.sourceIds.includes(id))));
});
