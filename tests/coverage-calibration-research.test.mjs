import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createCorpus} from '../research/coverage-gate-v2/corpus.mjs';
import {auditSourceCoverage,groupWarnings} from '../research/coverage-gate-v2/gate.mjs';
const docs=createCorpus('dev');
const get=family=>structuredClone(docs.find(c=>c.family===family));
const run=c=>auditSourceCoverage(c.layout,c.parsed);
const sources=r=>new Set(r.newWarnings.map(w=>w.sourceId));
test('preregistered DEV corpus digest unchanged; annotations never passed to gate',()=>{
 const expected=JSON.parse(readFileSync(new URL('../research/coverage-gate-v2/CORPUS_HASHES.json',import.meta.url)));
 assert.equal(createHash('sha256').update(JSON.stringify(docs)).digest('hex'),expected.dev.sha256);
 for(const c of docs){const copy=JSON.stringify(c);run(c);assert.equal(JSON.stringify(c),copy);}
});
test('source warning recall covers DEV essential signs, text, Unicode and duplicate amounts',()=>{
 for(const c of docs){
  const r=run(c),warned=sources(r);
  for(const w of r.existingWarnings)warned.add(w.sourceId);
  for(const [id,role]of Object.entries(c.oracle.annotations))if(role==='essential')assert.ok(warned.has(id),c.id+':'+id);
  assert.equal(r.canPersist,false);
 }
});
test('metadata suppression is exact and location-aware; monetary footer and metadata bait warn',()=>{
 for(const family of ['page-footer','document-id','version-heading'])assert.equal(run(get(family)).newWarnings.length,0);
 for(const family of ['footer-money','metadata-money'])assert.ok(run(get(family)).newWarnings.length>0);
 const c=get('page-footer');c.layout.observations.find(o=>o.raw==='Page 2 of 2').box.y0=.4;
 c.layout.observations.find(o=>o.raw==='Page 2 of 2').box.y1=.42;
 assert.ok(run(c).newWarnings.some(w=>w.sourceId===c.layout.observations.find(o=>o.raw==='Page 2 of 2').id));
});
test('forged field values, pending paylines and fake accounted IDs do not consume evidence',()=>{
 for(const f of ['forged-field','pending-payline','fake-accounted'])assert.equal(run(get(f)).canAutoAccept,false);
});
test('source warning still blocks an internally inconsistent ready decision',()=>{
 const r=run(get('inconsistent-decision'));assert.equal(r.canAutoAccept,false);assert.equal(r.existingWarnings.length,1);
 assert.equal(r.newWarnings.length,0);
});
test('original upstream block cannot be relaxed by metadata classification',()=>assert.equal(run(get('blocked-upstream')).canAutoAccept,false));
test('each malformed structure fails closed without uncaught exception',()=>{
 const mutations=[
 c=>c.layout.observations.push({...c.layout.observations[0]}),
 c=>delete c.layout.observations[0].id,
 c=>c.layout.observations[0].box.x0=NaN,
 c=>c.layout.observations[0].box.x1=2,
 c=>c.layout.observations[0].page=0,
 c=>c.parsed.fields=[],
 c=>c.parsed.fields.grossPay.sourceIds=['missing-source'],
 c=>c.parsed.payLines={},
 c=>c.parsed.payLines=[null],
 c=>c.parsed.decision.problems={},
 c=>c.parsed.decision.problems=[null],
 c=>c.parsed.decision.problems=[{code:'UNACCOUNTED_MATERIAL',detail:'missing'}]
 ];
 for(const mutation of mutations){const c=get('amount');mutation(c);const r=run(c);assert.equal(r.canAutoAccept,false);assert.ok(r.issues.length);}
});
test('completed payroll row validates exact source numeric multiset, not value membership',()=>{
 const c=get('document-id');
 const extra=['12345','5','5','25'].map((raw,i)=>({id:'row-'+i,raw,page:1,box:{x0:.1+i*.15,y0:.6,x1:.2+i*.15,y1:.62}}));
 c.layout.observations.push(...extra);
 c.parsed.payLines=[{code:'12345',category:'synthetic',quantity:5,unitPrice:5,factor:1,amount:25,sourceIds:extra.map(o=>o.id)}];
 assert.equal(run(c).canAutoAccept,true);
 extra[2].raw='99';assert.equal(run(c).canAutoAccept,false);
});
test('permutation invariance and lossless grouping over all DEV documents',()=>{
 for(const c of docs){const a=run(c),copy=structuredClone(c);copy.layout.observations.reverse();const b=run(copy);
  assert.deepEqual([...sources(a)].sort(),[...sources(b)].sort());assert.equal(a.canAutoAccept,b.canAutoAccept);
  assert.deepEqual(a.groups,b.groups);
  assert.deepEqual(a.groups.flatMap(g=>g.sourceIds).sort(),[...sources(a)].sort());
  for(const g of a.groups)for(const w of g.warnings)assert.equal(w.page,g.page);
 }
});
test('grouping cannot chain through a bridging row or cross pages',()=>{
 const w=(sourceId,y0,y1,page=1)=>({sourceId,page,box:{x0:.1,y0,x1:.2,y1}});
 const groups=groupWarnings([w('a',.2,.22),w('bridge',.21,.24),w('b',.23,.25),w('page2',.2,.22,2)]);
 assert.equal(groups.length,3);assert.equal(groups[0].sourceIds.length,2);
});
test('no geometry permits no metadata exemption and never invents a box',()=>{
 const c=get('document-id');const o=c.layout.observations.find(o=>o.raw.startsWith('Document ID:'));delete o.box;
 const r=run(c);assert.ok(r.newWarnings.some(w=>w.sourceId===o.id&&w.box===null));
});
