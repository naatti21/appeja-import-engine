import test from 'node:test';
import assert from 'node:assert/strict';
import {newFamilyCases,expectedDesign} from '../research/new-family-eval-v1/cases.mjs';
import {evaluateNewFamilies} from '../research/new-family-eval-v1/evaluate.mjs';

test('Y14 oracle collection has 12 different declared families and 36 case IDs',()=>{
 const cases=newFamilyCases();
 assert.equal(cases.length,36);
 assert.deepEqual(expectedDesign,{families:12,variantsPerFamily:3,documents:36,
   benignFamilies:6,essentialFamilies:6,benignDocuments:18,essentialDocuments:18});
 assert.equal(new Set(cases.map(c=>c.family)).size,12);
 assert.equal(cases.filter(c=>c.familyType==='benign').length,18);
 assert.equal(cases.filter(c=>c.familyType==='essential').length,18);
 for(const d of cases){
   assert.equal(Object.keys(d.annotations).length,d.layout.observations.length);
   assert.deepEqual(new Set(Object.keys(d.annotations)),
     new Set(d.layout.observations.map(o=>o.id)));
   assert.equal(d.layout.observations.filter(o=>d.annotations[o.id]==='linked').length,1);
   assert.equal(d.layout.observations.filter(o=>d.annotations[o.id]==='essential').length,
     d.familyType==='essential'?2:0);
 }
});
test('Y14 frozen gates score all annotated source IDs with no mutation or persistence',()=>{
 const before=JSON.stringify(newFamilyCases());
 const result=evaluateNewFamilies();
 assert.equal(result.dataset.documents,36);
 assert.match(result.dataset.corpusSHA256,/^[a-f0-9]{64}$/);
 assert.equal(result.independentQA,'NOT RUN');
 assert.equal(result.productionDecision,'NO-GO');
 for(const [name,v] of Object.entries(result.variants)){
  assert.equal(v.totals.documents,36,name);
  assert.equal(v.totals.benignDocuments,18,name);
  assert.equal(v.totals.essentialDocuments,18,name);
  assert.equal(v.totals.essential,36,name);
  assert.equal(v.totals.nuisance,72,name);
  assert.equal(v.totals.unexpectedPersist,0,name);
  assert.equal(v.totals.sourceMutations,0,name);
  assert.equal(v.details.length,36,name);
  assert.equal(Object.keys(v.byFamily).length,12,name);
  assert.ok(v.metrics.essentialRecall>=0&&v.metrics.essentialRecall<=1,name);
  assert.ok(v.metrics.nuisanceFPR>=0&&v.metrics.nuisanceFPR<=1,name);
  assert.ok(v.metrics.benignDocumentFalseBlockRate>=0&&
    v.metrics.benignDocumentFalseBlockRate<=1,name);
  assert.equal(v.researchThresholdsPass,Object.values(v.criteria).every(Boolean),name);
 }
 assert.equal(JSON.stringify(newFamilyCases()),before);
 assert.equal(result.y13.canPersist,false);
 assert.equal(result.y13.canAutoAccept,false);
 assert.equal(result.y13.comparableBenignFPR,false);
 console.log('Y14_DATASET '+JSON.stringify(result.dataset));
 console.log('Y14_GATE_METRICS '+JSON.stringify(Object.fromEntries(
   Object.entries(result.variants).map(([name,r])=>[name,{
    totals:r.totals,metrics:r.metrics,criteria:r.criteria,
    researchThresholdsPass:r.researchThresholdsPass}]))));
});
test('Y14 source-role hypotheses never upgrade frozen Y13 into import permission',()=>{
 const r=evaluateNewFamilies();
 assert.equal(r.y13.canAutoAccept,false);
 assert.equal(r.y13.canPersist,false);
 assert.equal(r.y13.comparableBenignFPR,false);
});
