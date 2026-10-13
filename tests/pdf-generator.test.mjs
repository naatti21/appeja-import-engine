import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticPayrollPdf} from '../demo/native-pdf.mjs';

test('synthetic fixture is a real two-page PDF byte stream, not fabricated PDF.js items',()=>{
  const bytes=syntheticPayrollPdf([{ytd:'42 000,00'},{ytd:'43 000,00'}]);
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length>600);
  assert.equal(new TextDecoder().decode(bytes.slice(0,8)),'%PDF-1.4');
  const source=new TextDecoder('latin1').decode(bytes);
  assert.match(source,/\/Count 2/);
  assert.match(source,/startxref/);
  assert.match(source,/endstream/);
});
test('fixture generation is bounded',()=>{
  assert.throws(()=>syntheticPayrollPdf(Array.from({length:6},()=>({}))),/page count/);
});
