import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifySources} from '../research/semantic-review-v1/classify.mjs';
const obs=(id,raw,y=.1)=>({id,raw,page:1,box:{x0:.1,x1:.8,y0:y,y1:y+.02}});
const layout=rows=>({sourceKind:'pdf-text',observations:rows,pages:[{page:1}],issues:[],unplacedObservations:[]});
test('semantic DEV: metadata lowers review burden but never hides appended money',()=>{
 const l=layout([obs('page','Page 1 of 1'),obs('extra','Page 1 of 1 99.95 EUR',.2)]),before=structuredClone(l),r=classifySources(l);
 assert.equal(r.entries[0].category,'administrative');assert.equal(r.entries[0].requiresCorrection,false);
 assert.equal(r.entries[1].requiresCorrection,true);assert.equal(r.canAutoAccept,false);assert.equal(r.canPersist,false);
 assert.deepEqual(l,before);assert.deepEqual(r.observations,l.observations);
});
test('semantic DEV: unknown text, currency, account, date, zero and split numbers remain actionable',()=>{
 for(const raw of ['Something unexplained','EUR','Account: SYN-7','2026-06-09','0','12',',50','Page 1 of 1\n75 USD']){
  assert.equal(classifySources(layout([obs('x',raw)])).entries[0].requiresCorrection,true,raw);
 }
});
test('semantic DEV: overlapping sources, duplicate IDs, wrong page and conflicting metadata fail closed',()=>{
 const cases=[layout([obs('a','Page 1 of 1'),obs('b','60 EUR')]),layout([obs('a','Page 1 of 1'),obs('a','Page 1 of 1',.2)]),layout([obs('a','Page 2 of 2')]),layout([obs('a','Document ID: DEV-A19'),obs('b','Document ID: DEV-B20',.2)])];
 for(const l of cases){const r=classifySources(l);assert.equal(r.correctionRequired,true);assert.ok(r.entries.every(e=>e.requiresCorrection));assert.equal(r.entries.length,l.observations.length);}
});
test('semantic DEV: reader issue and unplaced sources cannot disappear',()=>{
 const l=layout([obs('a','Page 1 of 1')]);l.issues=[{code:'BROKEN_READER'}];l.unplacedObservations=[{id:'lost',raw:'88.50'}];
 const r=classifySources(l);assert.equal(r.correctionRequired,true);assert.ok(r.entries.some(e=>e.sourceId==='lost'&&e.requiresCorrection));
});
test('semantic DEV: OCR and CSV do not inherit PDF metadata exemptions',()=>{
 for(const kind of ['csv','image-ocr-tsv']){const l=layout([obs('a','Page 1 of 1')]);l.sourceKind=kind;assert.equal(classifySources(l).entries[0].requiresCorrection,true);}
});
test('semantic DEV: complete finite timestamp and reference only, not money-like identifiers',()=>{
 for(const raw of ['Generated on: 2026-04-07T14:21:08Z','Document ID: DEV-42'])assert.equal(classifySources(layout([obs('a',raw)])).entries[0].requiresCorrection,false);
 for(const raw of ['Document ID: 3000','Document ID: DEV-42 67.00','Generated on: 2026-02-30T14:21:08Z'])assert.equal(classifySources(layout([obs('a',raw)])).entries[0].requiresCorrection,true);
});
