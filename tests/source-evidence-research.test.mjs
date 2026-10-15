import test from 'node:test';
import assert from 'node:assert/strict';
import {base,d1,observation,SEED} from '../research/source-evidence-v1/fixtures.mjs';
const modulePath=process.env.SOURCE_EVIDENCE_BASELINE==='1'?
 '../research/coverage-gate-v2/gate.mjs':'../research/source-evidence-v1/gate.mjs';
const {auditSourceCoverage}=await import(modulePath);
const run=c=>auditSourceCoverage(c.layout,c.parsed);
const warned=(r,id)=>r.newWarnings.some(w=>w.sourceId===id);
test('D1 extra monetary source must not be consumed by verified date',()=>{
 const r=run(d1());console.log('D1_OBSERVED '+JSON.stringify({seed:SEED,canAutoAccept:r.canAutoAccept,newWarnings:r.newWarnings}));
 assert.equal(r.canAutoAccept,false);assert.ok(warned(r,'extra-money'));assert.equal(r.canPersist,false);
});
