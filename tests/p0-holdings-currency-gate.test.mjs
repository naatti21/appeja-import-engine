// Isolated P0 safety regression: CSV row must never advertise auto acceptance
// without an explicit, syntactically valid currency. All data is synthetic.
// These assertions intentionally fail on the unmodified research baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHoldingsCsv} from '../src/holdings.mjs';

function assertBlocked(csv,caseName) {
  const r=parseHoldingsCsv(csv);
  assert.equal(r.records.length,1,caseName+': one parsed row expected');
  assert.equal(r.records[0].status,'review-required',caseName+': row review required');
  assert.equal(r.canAutoAccept,false,caseName+': entire batch must not auto accept');
  assert.equal(r.status,'review-required',caseName+': batch review required');
  assert.ok(r.records[0].issues.some(i=>i.code==='CURRENCY_MISSING_REVIEW'||i.code==='CURRENCY_INVALID_REVIEW'),caseName+': reason-specific currency notice required');
}

test('P0: missing currency header is review-required, not candidate-ready',()=>{
  assertBlocked('Name;Quantity;Buy Price\nSynthetic A;5;4.25','absent currency column');
});

test('P0: empty currency cell is review-required, not candidate-ready',()=>{
  assertBlocked('Name;Quantity;Buy Price;Currency\nSynthetic A;5;4.25;','empty currency cell');
});

test('P0: malformed four-letter currency is review-required',()=>{
  assertBlocked('Name;Quantity;Buy Price;Currency\nSynthetic A;5;4.25;EURO','invalid currency token');
});

test('control: explicit uppercase ISO-shaped currency keeps candidate-only status',()=>{
  const result=parseHoldingsCsv('Name;Quantity;Buy Price;Currency\nSynthetic A;5;4.25;EUR');
  assert.equal(result.records.length,1);
  assert.equal(result.records[0].status,'candidate-only');
  assert.equal(result.status,'candidate-only');
  assert.equal(result.canAutoAccept,true); // Research flag only; never persistence GO.
});
