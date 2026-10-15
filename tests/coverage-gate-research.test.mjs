import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditNumericCoverage} from '../research/coverage-gate-v1/gate.mjs';

const base = new URL('../research/structure-reliability-v1/raw/E/', import.meta.url);
function data(id) { return JSON.parse(readFileSync(new URL(id+'.json', base), 'utf8')); }
function token(id, raw, page=1) { return {id, raw, page, material:false, kind:'text'}; }
function candidate(extra=[]) {
  const observations = [token('p1','2026-10-13'),token('p2','3 200,00'),
    token('p3','2 450,00'),token('p4','42 000,00'),...extra];
  const fields = Object.fromEntries(['payDate','grossPay','netPay','ytdTaxableIncome']
    .map((name,i)=>[name,{status:'verified',sourceIds:['p'+(i+1)],value:i}]));
  return {layout:{observations},parsed:{fields,payLines:[],
    decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}}};
}

test('unlinked material=false financial amount blocks candidate-ready; original unchanged',()=>{
  const {layout,parsed}=candidate([token('unknown','690.10')]);
  const original=structuredClone(parsed);
  const report=auditNumericCoverage(layout,parsed);
  assert.equal(report.status,'review-required');
  assert.equal(report.canPersist,false);
  assert.deepEqual(report.newWarnings.map(w=>w.sourceId),['unknown']);
  assert.deepEqual(parsed,original);
});
test('zero, percentage, signed and split digits stay individually traceable',()=>{
  const {layout,parsed}=candidate([token('zero','0'),token('pct','24.00 %'),
    token('negative','-15,10'),token('fragment1','3'),token('fragment2','456,78')]);
  const r=auditNumericCoverage(layout,parsed);
  assert.deepEqual(r.newWarnings.map(w=>w.sourceId),['zero','pct','negative','fragment1','fragment2']);
});
test('same amount twice is not deduplicated by raw value',()=>{
  const {layout,parsed}=candidate([token('a','150,55'),token('b','150,55')]);
  assert.equal(auditNumericCoverage(layout,parsed).summary.newlyWarned,2);
});
test('already targeted UNACCOUNTED_MATERIAL is not double reported',()=>{
  const {layout,parsed}=candidate([token('extra','690,10')]);
  parsed.decision.problems.push({code:'UNACCOUNTED_MATERIAL',detail:'extra'});
  parsed.decision.status='review-required';parsed.decision.canAutoAccept=false;
  const r=auditNumericCoverage(layout,parsed);
  assert.equal(r.summary.alreadyWarned,1);
  assert.equal(r.summary.newlyWarned,0);
  assert.equal(r.status,'review-required');
});
test('non-numeric unlinked heading remains out of this deliberately limited gate',()=>{
  const {layout,parsed}=candidate([token('heading','Fictional heading')]);
  const r=auditNumericCoverage(layout,parsed);
  assert.equal(r.summary.newlyWarned,0);
  assert.equal(r.status,'candidate-ready');
});
test('malformed or duplicate observations and fabricated source IDs fail closed',()=>{
  const missing=candidate();missing.parsed.fields.grossPay.sourceIds=['does-not-exist'];
  assert.equal(auditNumericCoverage(missing.layout,missing.parsed).issues[0].code,'INVALID_LINKED_SOURCE');
  const duplicate=candidate([token('p1','444.44')]);
  assert.equal(auditNumericCoverage(duplicate.layout,duplicate.parsed).issues[0].code,'INVALID_SOURCE_OBSERVATION');
  assert.equal(auditNumericCoverage({},{}).status,'review-required');
});
test('existing DEV real-PDF.js E outputs show numeric-source coverage blind spot',()=>{
  const expected = {P01:8,P02:8,P03:7,T01:3,T02:7,T03:5};
  for (const [id,warnings] of Object.entries(expected)) {
    const {layout,parsed}=data(id);
    const result=auditNumericCoverage(layout,parsed);
    assert.equal(result.summary.newlyWarned,warnings,id);
    assert.equal(result.canPersist,false,id);
    if (id === 'P02') {
      assert.equal(parsed.decision.status,'candidate-ready');
      assert.equal(result.status,'review-required');
    }
  }
});
