import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDelimited} from '../src/csv.mjs';
import {parseNumber} from '../src/numbers.mjs';
import {resolveCandidates} from '../src/evidence.mjs';
import {parseHoldingsCsv} from '../src/holdings.mjs';

test('semicolon Finnish CSV is recognized and raw cells retained',()=>{
  const r=parseDelimited('Nimi;Määrä;Keskihinta\nNokia;100;4,20');
  assert.equal(r.delimiter,';');
  assert.equal(r.observations.length,6);
  assert.equal(r.observations.at(-1).raw,'4,20');
});
test('quoted newlines are part of one field, not a new record',()=>{
  const r=parseDelimited('Name,Quantity,Buy Price\n"Microsoft\nCorporation",12,315.00');
  assert.equal(r.rows.length,2);
  assert.equal(r.rows[1].values[0],'Microsoft\nCorporation');
  assert.equal(r.observations.filter(o=>o.row===2).length,3);
});
test('escaped double quote inside quoted field is decoded',()=>{
  const r=parseDelimited('Name;Quantity\n"ACME ""A"" Oy";1');
  assert.equal(r.rows[1].values[0],'ACME "A" Oy');
});
test('tab-delimited TSV supported',()=>{
  const r=parseDelimited('Name\tQuantity\nNokia\t5');
  assert.equal(r.delimiter,'\t');
});
test('trailing empty cells distinguish missing amount from zero',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price\nNokia;5;\nMicrosoft;12;0');
  assert.equal(r.records[0].fields.buyPrice.status,'missing');
  assert.equal(r.records[0].fields.buyPrice.value,null);
  assert.equal(r.records[1].fields.buyPrice.status,'valid');
  assert.equal(r.records[1].fields.buyPrice.value,0);
  assert.equal(r.canAutoAccept,false);
});
test('malformed quote blocks import instead of shifting cells',()=>{
  assert.throws(()=>parseDelimited('Name;Quantity\n"Nokia;2'),/tunnistaa|lainaus/);
});
test('ragged row retained with explicit issue',()=>{
  const r=parseDelimited('Name;Quantity;Buy Price\nNokia;7');
  assert.ok(r.issues.some(x=>x.code==='INCONSISTENT_CSV_WIDTH'));
  assert.equal(r.observations.filter(o=>o.row===2).length,2);
});
test('locale numeric parser validates complete tokens',()=>{
  assert.deepEqual(parseNumber('1 234,50').value,1234.5);
  assert.deepEqual(parseNumber('1.234,50').value,1234.5);
  assert.deepEqual(parseNumber('1,234.50').value,1234.5);
  assert.equal(parseNumber('12 3a4,50').status,'invalid');
  assert.equal(parseNumber('1,234').status,'ambiguous');
  assert.equal(parseNumber('0').status,'valid');
  assert.equal(parseNumber('').status,'missing');
});
test('ambiguous quantity cannot be silently read as 1234',()=>{
  const r=parseHoldingsCsv('Ticker,Quantity,Buy Price\nMSFT,"1,234",315.00');
  assert.equal(r.records[0].fields.quantity.status,'ambiguous');
  assert.equal(r.canAutoAccept,false);
});
test('same ticker with different MICs remains two records',()=>{
  const r=parseHoldingsCsv('Ticker;Quantity;Buy Price;MIC\nABC;2;20;XHEL\nABC;5;21;XETR');
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.fields.mic.value),['XHEL','XETR']);
});
test('broker is not silently converted to account type',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price;Broker\nNokia;10;5;Nordea');
  assert.equal(r.records[0].fields.broker.value,'Nordea');
  assert.equal(r.records[0].fields.accountType,undefined);
});
test('unknown populated column is retained and blocks auto acceptance',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price;Mystery\nNokia;10;5;important');
  assert.equal(r.unusedObservations.length,1);
  assert.equal(r.unusedObservations[0].raw,'important');
  assert.equal(r.canAutoAccept,false);
});
test('invalid ISIN format retained, no identity guess',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price;ISIN\nNokia;10;5;FI-???');
  assert.equal(r.records[0].fields.isin.raw,'FI-???');
  assert.equal(r.records[0].fields.isin.status,'invalid');
  assert.equal(r.canAutoAccept,false);
});
test('inconsistent CSV row prevents whole batch acceptance',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price\nNokia;5;4\nBad;0;8');
  assert.equal(r.records.length,2);
  assert.equal(r.records[1].status,'review-required');
  assert.equal(r.canAutoAccept,false);
});
test('same number repeated twice is not a semantic conflict',()=>{
  const r=resolveCandidates([{status:'valid',value:42000,observationId:'a'},
    {status:'valid',value:42000,observationId:'b'}]);
  assert.equal(r.status,'unique');
  assert.equal(r.candidates.length,2);
});
test('different numbers are a semantic conflict even if confidence looks good',()=>{
  const r=resolveCandidates([{status:'valid',value:42000,confidence:0.99},
    {status:'valid',value:43000,confidence:0.99}]);
  assert.equal(r.status,'conflict');
  assert.equal(r.value,null);
});
test('nonempty extra columns produce no fake safe import',()=>{
  const r=parseHoldingsCsv('Name;Quantity;Buy Price\nNokia;5;4;INVISIBLE');
  assert.ok(r.issues.some(i=>i.code==='INCONSISTENT_CSV_WIDTH'));
  assert.ok(r.unusedObservations.some(o=>o.raw==='INVISIBLE'));
  assert.equal(r.canAutoAccept,false);
});

test('ISIN checksum (not just shape) must be correct',()=>{
  const pass=parseHoldingsCsv('Name;Quantity;Buy Price;ISIN\nMicrosoft;12;315;US5949181045');
  assert.equal(pass.records[0].fields.isin.status,'valid');
  const fail=parseHoldingsCsv('Name;Quantity;Buy Price;ISIN\nMicrosoft;12;315;US5949181046');
  assert.equal(fail.records[0].fields.isin.status,'invalid');
  assert.equal(fail.canAutoAccept,false);
});
