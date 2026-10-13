import test from 'node:test';
import assert from 'node:assert/strict';
import {baseLayouts,scenarios} from './fixtures/benchmark-75.mjs';
import {syntheticPayrollPdf} from '../demo/native-pdf.mjs';
test('75 synthetic PDFs: 25 controlled bases with two adversarial variants each',()=>{
  assert.equal(baseLayouts.length,25);
  assert.equal(scenarios.length,75);
  assert.equal(scenarios.filter(s=>s.kind==='clean').length,25);
  assert.equal(scenarios.filter(s=>s.kind==='conflicting-ytd').length,25);
  assert.equal(scenarios.filter(s=>s.kind==='missing-ytd').length,25);
  for(const fixture of scenarios){
    assert.ok(syntheticPayrollPdf(fixture.pages).byteLength>500,fixture.id);
    assert.ok(fixture.pages.every(p=>!p.rotate&&!p.crop),fixture.id);
  }
});
test('benchmark corpus uses only explicit synthetic data',()=>{
  for(const s of scenarios){
    assert.equal(s.pages[0].fullSlip,true,s.id);
    assert.equal(s.pages.slice(1).every(p=>!p.fullSlip),true,s.id);
    if(s.kind==='conflicting-ytd')assert.equal(s.oracle.problem,'conflict');
    if(s.kind==='missing-ytd')assert.equal(s.oracle.problem,'MISSING_TABLE_VALUE');
  }
});
