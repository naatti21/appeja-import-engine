import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileFixture} from './fixtures/mobile-cards.mjs';
import {resolveMobileCards,documentKey,corroborateOcrIdentities} from '../src/mobile-card-holdings.mjs';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {createMobileReviewSession} from '../src/mobile-review-session.mjs';

// Positive controls add explicit name evidence; old tests/fixtures are NOT edited.
function labelled(opts={}) {
 const f=mobileFixture({ambiguous:false,...opts});f.source.schemaVersion=1;
 for(const item of f.oracle)f.source.observations.find(o=>o.raw===item.name).raw='Instrument name: '+item.name;
 return f;
}
const rowByTicker=(r,t)=>r.rows.find(x=>x.fields.identity.value.ticker===t);
function trace(result,source){assert.equal(result.canPersist,false);for(const row of result.rows){
 assert.equal(row.canPersist,false);assert.equal(row.instrumentVerification.status,'not-verified');
 for(const field of Object.values(row.fields))for(const id of field.sourceIds)assert.ok(source.observations.some(o=>o.id===id));
}}

test('issue45 P0: repeated real name across listings cannot make varying section headings into names',async()=>{
 for(const entity of [0,1]){
  const learner=createStructureLearner();let last;
  for(let round=0;round<3;round++){
   const f=mobileFixture({round});
   const headers=['Long horizon sleeve','Income sleeve','Reserve sleeve'];
   f.source.observations.filter(o=>o.raw==='Research basket').forEach((o,i)=>o.raw=headers[i]);
   for(const item of f.oracle)f.source.observations.find(o=>o.raw===item.name).raw='Fictional Shared Issuer';
   if(entity===1){for(let i=0;i<3;i++){
    const header=f.source.observations.find(o=>o.raw===headers[i]);
    const name=f.source.observations.find(o=>o.raw==='Fictional Shared Issuer'&&o.source.box.y0>header.source.box.y0);
    [header.raw,name.raw]=[name.raw,header.raw];
   }}
   last=f.source;
   if(round<2){const c=resolveMobileCards(last,learner).cards[0];
    learner.confirm({pattern:c.pattern,binding:{entity,identity:2,measure:3},documentKey:await documentKey(last),confirmed:true});}
  }
  const before=learner.export(),r=resolveMobileCards(last,learner);
  assert.deepEqual(r.rows,[],'Varying headings are NOT independent name evidence');
  assert.deepEqual(learner.export(),before);trace(r,last);
 }
});

test('issue45 A01: a source-labelled name enables candidates but current price never becomes cost',()=>{
 const f=labelled(),r=resolveMobileCards(f.source);assert.equal(r.rows.length,3);
 assert.ok(r.rows.every(x=>x.fields.buyPrice.value===null));trace(r,f.source);
});
test('issue45 A02: malformed/missing identity and extra quantity block only the affected labelled card',()=>{
 for(const raw of ['Ticker: QJPA','ISIN: US0000000000','Quantity: 99']){
  const f=labelled();f.source.observations.find(o=>o.raw.startsWith('Ticker')).raw=raw;
  const r=resolveMobileCards(f.source);assert.equal(r.rows.length,2);assert.equal(rowByTicker(r,'QJPA'),undefined);trace(r,f.source);
 }
});
test('issue45 A03: duplicate holdings do not merge; accounts, pages and venues remain distinct',()=>{
 const f=labelled(),ids=f.source.observations.filter(o=>o.raw.startsWith('Ticker'));
 ids[1].raw=ids[0].raw;let r=resolveMobileCards(f.source);assert.equal(r.rows.length,1);assert.equal(r.unresolved.filter(x=>x.reason==='DUPLICATE_HOLDING').length,2);
 ids[1].raw=ids[0].raw.replace('XNAS','XSTO');r=resolveMobileCards(f.source);assert.equal(r.rows.length,3);
 const b=labelled({account:'Other'});b.source.observations.forEach(o=>{o.id='b'+o.id;o.source.page=2;});
 const s={...f.source,observations:[...f.source.observations,...b.source.observations]};r=resolveMobileCards(s);assert.equal(r.rows.length,6);assert.equal(new Set(r.rows.map(x=>x.fields.account.value)).size,2);trace(r,s);
});
test('issue45 A04: international names and missing currency are preserved without guesses',()=>{
 const f=labelled(),names=['Ångström Teknik','新しい研究','Meridian Fund'];
 f.source.observations.filter(o=>o.raw.startsWith('Instrument name:')).forEach((o,i)=>o.raw='Instrument name: '+names[i]);
 f.source.observations.filter(o=>o.raw==='Currency: USD').forEach(o=>o.raw='Show sources');
 const r=resolveMobileCards(f.source);assert.deepEqual(r.rows.map(x=>x.fields.name.value),names);assert.ok(r.rows.every(x=>x.fields.currency.value===null));trace(r,f.source);
});
test('issue45 A05: duplicate IDs, weak OCR, invalid page and split columns retain fail-closed gates',()=>{
 for(const mutate of [f=>f.source.observations[1].id=f.source.observations[0].id,
  f=>f.source.observations.find(o=>o.raw.startsWith('Quantity')).ocrConfidence=null,
  f=>f.source.observations.find(o=>o.raw.startsWith('Quantity')).source.page=0,
  f=>{const q=f.source.observations.find(o=>o.raw.startsWith('Quantity'));f.source.observations.push({...q,id:'far-column',raw:'Other',source:{...q.source,box:{...q.source.box,x0:.8,x1:.99}}});}]){
  const f=labelled();mutate(f);assert.ok(resolveMobileCards(f.source).rows.length<3);
 }
});
test('issue45 A06: missing page account and unexplained section cannot inherit previous account',()=>{
 const a=labelled(),b=labelled();b.source.observations=b.source.observations.filter(o=>!o.raw.startsWith('Account:'));
 b.source.observations.forEach(o=>{o.id='b'+o.id;o.source.page=2;});
 let r=resolveMobileCards({...a.source,observations:[...a.source.observations,...b.source.observations]});
 assert.equal(r.rows.length,6);assert.ok(r.rows.slice(3).every(x=>x.fields.account.value===null));
 const f=labelled(),c=f.source.observations.find(o=>o.raw==='More'),acc=f.source.observations.find(o=>o.raw.startsWith('Account:'));
 c.raw='Unexplained section';c.source.box.y0=.06;c.source.box.y1=.075;acc.source.box.y0=.005;acc.source.box.y1=.02;
 r=resolveMobileCards(f.source);assert.equal(r.rows.length,3);assert.ok(r.rows.every(x=>x.fields.account.value===null));
});
test('issue45 A07: ISIN checksum is checked but cannot verify an instrument',()=>{
 let matches=0;
 for(let n=0;n<10;n++){const f=labelled();f.source.observations.find(o=>o.raw.startsWith('Ticker')).raw='ISIN: ZZ123456789'+n;
  const r=resolveMobileCards(f.source);if(r.rows.length===3){matches++;trace(r,f.source);}}
 assert.equal(matches,1);
});
test('issue45 A08: per-field OCR correction preserves source, provenance and independent cards; undo reinstates block',()=>{
 for(const [intended,observed] of [['QX','OX'],['IX','1X'],['LX','1X'],['SX','5X'],['BX','8X']]){
  const f=labelled(),w=structuredClone(f.source),o=f.source.observations.find(o=>o.raw.startsWith('Ticker'));
  o.raw=`Ticker: ${observed} MIC: XNAS`;w.observations.find(x=>x.id===o.id).raw=`Ticker: ${intended} MIC: XNAS`;
  const s=corroborateOcrIdentities(f.source,w),session=createMobileReviewSession(s),i=session.lines().findIndex(l=>l.role==='identity');
  assert.equal(session.resolve().rows.length,2);
  session.correct({line:i,field:'identity',value:`Ticker: ${intended} MIC: XNAS`,confirmed:true});
  const r=session.resolve();assert.equal(r.rows.length,3);assert.equal(r.rows[0].fields.identity.value.ticker,intended);
  assert.equal(r.rows[1].fields.identity.value.ticker,'QCBT');trace(r,s);
  assert.equal(session.snapshot().source.observations.find(x=>x.id===o.id).raw,o.raw);
  assert.equal(session.snapshot().records[i].fields.text.suggestedValue,o.raw);
  session.undo(i);assert.equal(session.resolve().rows.length,2);
 }
});
test('issue45 A09: closed labels, quantities and identity validation do not change name text',()=>{
 for(const label of ['Maara','Määrä','Quantity','Antal']){
  const f=labelled();f.source.observations.find(o=>o.raw.startsWith('Quantity')).raw=label+': 12';
  f.source.observations.find(o=>o.raw.startsWith('Instrument name:')).raw='Instrument name: Äänekosken Öljy';
  f.source.observations.find(o=>o.raw.startsWith('Day change:')).raw='Paivan muutos: +2 %';
  const r=resolveMobileCards(f.source);assert.equal(r.rows.length,3);assert.equal(r.rows[0].fields.quantity.value,12);assert.equal(r.rows[0].fields.name.value,'Äänekosken Öljy');
 }
 for(const label of ['Mystery: 12','Quantity: 1,234']){const f=labelled();f.source.observations.find(o=>o.raw.startsWith('Quantity')).raw=label;assert.equal(resolveMobileCards(f.source).rows.length,2);}
});
test('issue45 A10: untrusted source metadata cannot grant user confirmation or restore low-confidence ticker',()=>{
 const f=labelled(),o=f.source.observations.find(o=>o.raw.startsWith('Ticker'));o.ocrConfidence=20;o.reviewCorrection={field:'identity',sourceIds:[o.id]};
 assert.equal(resolveMobileCards(f.source).rows.length,2);assert.equal(createMobileReviewSession(f.source).resolve().rows.length,2);
});
