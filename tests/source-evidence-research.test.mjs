import test from 'node:test';
import assert from 'node:assert/strict';
import {base,d1,observation,SEED} from '../research/source-evidence-v1/fixtures.mjs';
import {impactCases} from '../research/source-evidence-v1/cases.mjs';
const modulePath=process.env.SOURCE_EVIDENCE_BASELINE==='1'?
 '../research/coverage-gate-v2/gate.mjs':'../research/source-evidence-v1/gate.mjs';
const {auditSourceCoverage}=await import(modulePath);
const run=c=>auditSourceCoverage(c.layout,c.parsed);
const warned=(r,id)=>r.newWarnings.some(w=>w.sourceId===id);
test('D1 extra monetary source must not be consumed by verified date',()=>{
 const r=run(d1());console.log('D1_OBSERVED '+JSON.stringify({seed:SEED,canAutoAccept:r.canAutoAccept,newWarnings:r.newWarnings}));
 assert.equal(r.canAutoAccept,false);assert.ok(warned(r,'extra-money'));assert.equal(r.canPersist,false);
});
for(const c of impactCases())test('source safety '+c.id,()=>{
 const before=JSON.stringify(c.input),r=run(c.input);
 assert.equal(r.canAutoAccept,c.expected.accept,c.id);
 for(const id of c.expected.warnIds)assert.ok(warned(r,id),c.id+':'+id);
 assert.equal(r.canPersist,false);assert.equal(JSON.stringify(c.input),before);
 assert.equal(r.summary?.newlyWarned,r.newWarnings.length);
});
test('source permutation and warning grouping retain all IDs',()=>{
 for(const c of impactCases()){
  const first=run(c.input),other=structuredClone(c.input);other.layout.observations.reverse();
  for(const f of Object.values(other.parsed.fields)){f.sourceIds?.reverse();for(const ids of Object.values(f.sourceRoles??{}))ids.reverse();}
  const second=run(other);assert.equal(second.canAutoAccept,first.canAutoAccept,c.id);
  assert.deepEqual(second.newWarnings.map(w=>w.sourceId).sort(),first.newWarnings.map(w=>w.sourceId).sort());
  assert.deepEqual(first.groups.flatMap(g=>g.sourceIds).sort(),first.newWarnings.map(w=>w.sourceId).sort());
 }
});
test('malformed role structures and declared-but-unproven context fail closed',()=>{
 const changes=[
  c=>c.parsed.fields.payDate.sourceRoles=[],
  c=>c.parsed.fields.payDate.sourceRoles={valueIds:['date'],headerIds:'date'},
  c=>c.parsed.fields.payDate.sourceRoles={valueIds:['date'],unusedIds:['gross']},
  c=>c.parsed.fields.grossPay.context={currency:'EUR'},
  c=>c.parsed.fields.grossPay.context={unknown:'EUR'},
  c=>c.layout.observations.push({...c.layout.observations[0]}),
  c=>c.layout.observations[0].box.x1=2,
  c=>c.parsed.payLines=[null],
  c=>c.parsed.decision.problems=[null]
 ];
 for(const change of changes){const c=base();change(c);const r=run(c);assert.equal(r.canAutoAccept,false);assert.equal(r.canPersist,false);}
});
