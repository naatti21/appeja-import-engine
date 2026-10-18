import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {documentKey,resolveMobileCards} from '../src/mobile-card-holdings.mjs';
import {mobileFixture} from './fixtures/mobile-cards.mjs';

async function teachWrong(learner,layout='en'){
  for(const round of [0,1]){
    const f=mobileFixture({layout,round});
    const card=resolveMobileCards(f.source,learner).cards.find(c=>c.teachable);
    assert.ok(card,'Card with source evidence expected');
    assert.equal(learner.confirm({
      pattern:card.pattern,
      binding:{entity:0,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')},
      documentKey:await documentKey(f.source),confirmed:true
    }),round===0?'provisional':'active');
  }
}
async function teachCorrect(learner){
  for(const round of [0,1]){
    const f=mobileFixture({round});
    const card=resolveMobileCards(f.source,learner).cards.find(c=>c.teachable);
    assert.ok(card);
    learner.confirm({pattern:card.pattern,binding:{
      entity:1,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')
    },documentKey:await documentKey(f.source),confirmed:true});
  }
}
test('active teaching plus three independent cards: repeated banner is not a name',async()=>{
  for(const layout of ['en','fi']){
    const learner=createStructureLearner();
    for(const round of [0,1]){
      const taught=mobileFixture({layout,round});
      const card=resolveMobileCards(taught.source,learner).cards.find(c=>c.teachable);
      learner.confirm({pattern:card.pattern,binding:{entity:1,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')},documentKey:await documentKey(taught.source),confirmed:true});
    }
    const f=mobileFixture({layout,round:2});
    const result=resolveMobileCards(f.source,learner);
    assert.equal(result.rows.length,3);
    assert.equal(result.unresolved.length,0);
    result.rows.forEach((row,i)=>{
      assert.equal(row.fields.name.value,f.oracle[i].name);
      assert.equal(row.fields.identity.value.ticker,f.oracle[i].ticker);
      assert.equal(row.fields.quantity.value,f.oracle[i].qty);
      assert.equal(row.nameEvidence,'current-document-cross-card-contrast');
      assert.equal(row.instrumentVerification.status,'not-verified');
      assert.equal(row.canPersist,false);
      assert.ok(row.fields.name.sourceIds.every(id=>f.source.observations.some(o=>o.id===id)));
    });
  }
});
test('two independently confirmed wrong teaching selections never turn a repeated banner into an instrument',async()=>{
  const learner=createStructureLearner();
  await teachWrong(learner);
  const f=mobileFixture({round:2}),before=JSON.stringify(learner.export());
  const result=resolveMobileCards(f.source,learner);
  assert.deepEqual(result.rows,[]);
  assert.equal(result.unresolved.filter(x=>x.reason==='LEARNED_NAME_CONFLICT').length,3);
  assert.equal(JSON.stringify(learner.export()),before);
});
test('swapping repeated banner and real name conflicts with previously learned position',async()=>{
  const learner=createStructureLearner();
  await teachCorrect(learner);
  const f=mobileFixture({round:2});
  for(const entry of f.oracle){
    const name=f.source.observations.find(o=>o.raw===entry.name);
    const before=f.source.observations.filter(o=>o.raw==='Research basket')
      .find(o=>o.source.box.y0<name.source.box.y0&&name.source.box.y0-o.source.box.y0<.07);
    assert.ok(name&&before);
    const old=before.raw;before.raw=name.raw;name.raw=old;
  }
  const result=resolveMobileCards(f.source,learner);
  assert.equal(result.rows.length,0);
  assert.equal(result.unresolved.filter(x=>x.reason==='LEARNED_NAME_CONFLICT').length,3);
  assert.equal(result.canPersist,false);
});
test('one or two cards do not establish cross-card semantics, even after learning',async()=>{
  const learner=createStructureLearner();await teachCorrect(learner);
  const f=mobileFixture({round:2});
  const all=resolveMobileCards(f.source,learner);
  assert.equal(all.rows.length,3);
  // Remove third card and trailing controls, retaining all earlier card geometry.
  const start=f.source.observations.findIndex(o=>o.raw===f.oracle[2].name);
  const end=f.source.observations.findIndex(o=>o.raw==='Balance: 1000 EUR');
  const s=structuredClone(f.source);
  s.observations=s.observations.filter((_,i)=>!(i>=start-1&&i<end));
  const result=resolveMobileCards(s,learner);
  assert.equal(result.rows.length,0);
  assert.equal(result.canPersist,false);
});
test('explicit labelled names still work on isolated cards',()=>{
  const f=mobileFixture({ambiguous:false});
  for(const item of f.oracle)f.source.observations.find(o=>o.raw===item.name).raw='Instrument name: '+item.name;
  const result=resolveMobileCards(f.source);
  assert.equal(result.rows.length,3);
  assert.deepEqual(result.rows.map(r=>r.nameEvidence),['source-label','source-label','source-label']);
});
test('changing any source identity role into unknown prevents promotion',()=>{
 const f=mobileFixture();
 f.source.observations.find(o=>o.raw.startsWith('Ticker:')).raw='Ticker: missing exchange';
 const result=resolveMobileCards(f.source);
 assert.equal(result.rows.length,0); // only two independently identified cards remain
 assert.equal(result.canPersist,false);
});


test('one low-confidence ticker may help identify layout but its own row remains blocked',async()=>{
  const learner=createStructureLearner();await teachCorrect(learner);
  const f=mobileFixture({round:2});
  f.source.observations.find(o=>o.raw.startsWith('Ticker:')).ocrConfidence=70;
  const result=resolveMobileCards(f.source,learner);
  assert.equal(result.rows.length,2);
  assert.equal(result.unresolved.length,1);
  assert.deepEqual(result.rows.map(r=>r.fields.name.value),f.oracle.slice(1).map(o=>o.name));
  assert.ok(result.rows.every(r=>r.instrumentVerification.status==='not-verified'&&!r.canPersist));
});
