import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileFixture} from './fixtures/mobile-cards.mjs';
import {visualLedgerFixture} from './fixtures/portfolio-visual-ledger.mjs';
import {inlineLedgerFixture} from './fixtures/portfolio-inline-ledger.mjs';
import {resolveMobileCards,documentKey} from '../src/mobile-card-holdings.mjs';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {extractVisualPortfolio,extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';
import {suggestInstrumentListings,selectInstrumentListing} from '../src/portfolio-instrument-listings.mjs';
import {preparePortfolioIdentityReview,chooseInstrumentIdentity}
 from '../src/portfolio-identity-review.mjs';

test('legacy card role teaching cannot promote an unlabeled name, even after two confirmations',async()=>{
 const learner=createStructureLearner();
 for(let round=0;round<2;round++){
   const f=mobileFixture({round});
   const first=resolveMobileCards(f.source,learner).cards.find(c=>c.teachable);
   assert.ok(first);
   learner.confirm({pattern:first.pattern,
     binding:{entity:1,identity:first.pattern.indexOf('identity'),measure:first.pattern.indexOf('measure')},
     documentKey:await documentKey(f.source),confirmed:true});
 }
 const f=mobileFixture({round:2});
 const before=JSON.stringify(learner.export());
 const r=resolveMobileCards(f.source,learner);
 assert.equal(r.rows.length,0);
 assert.ok(r.unresolved.length>=3);
 assert.equal(JSON.stringify(learner.export()),before);
 assert.equal(r.canPersist,false);
});
test('explicit source-labelled name remains a reviewable legacy candidate, not a verified market security',()=>{
 const f=mobileFixture({ambiguous:false});
 for(const entry of f.oracle) {
   const o=f.source.observations.find(o=>o.raw===entry.name);
   assert.ok(o);o.raw='Instrument name: '+entry.name;
 }
 const r=resolveMobileCards(f.source);
 assert.equal(r.rows.length,3);
 for(const row of r.rows) {
   assert.equal(row.nameEvidence,'source-label');
   assert.equal(row.instrumentVerification.status,'not-verified');
   assert.equal(row.canPersist,false);
 }
});
test('visual full-source adapter reads unlabelled stocks/fund, never asks about headings or cash',()=>{
 const f=visualLedgerFixture();
 const r=extractVisualPortfolio(f.source);
 assert.deepEqual(r.candidates.map(c=>({
   kind:c.kind,name:c.fields.name.value,qty:c.fields.quantity.value,
   cents:c.fields.marketValue.value?.cents
 })),f.oracle);
 assert.equal(r.reconciliation.status,'pass');
 assert.equal(r.reconciliation.completenessProven,false);
 assert.ok(r.candidates.every(c=>!c.canPersist&&c.marketVerification.status==='not-verified'));
 assert.ok(r.candidates.every(c=>!(/^(Osakkeet|Rahastot|Säästötilit|Arvonmuutos|Käytettävissä)/iu).test(c.fields.name.value)));
});
test('cash reconciliation mismatch does not change accepted source name or confer identity',()=>{
 const f=visualLedgerFixture({wrongTotal:true});
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,5);
 assert.equal(r.reconciliation.status,'mismatch');
 assert.equal(r.reconciliation.differenceCents,-1);
 assert.ok(r.candidates.every(c=>c.marketVerification.status==='not-verified'&&!c.canPersist));
});
test('two OCR passes must agree on compact rows before name can become a source candidate',()=>{
 const f=inlineLedgerFixture();
 const witness=structuredClone(f.source);
 witness.observations.find(o=>o.raw==='Silver Pine').raw='SiIver Pine';
 const r=extractVisualPortfolioCorroborated(f.source,witness);
 assert.equal(r.candidates.length,3);
 assert.ok(!r.candidates.some(c=>c.fields.name.value==='Silver Pine'));
 assert.ok(r.unresolved.some(x=>x.reason==='OCR_NAME_DISAGREEMENT'));
 assert.equal(r.reconciliation.status,'not-evaluable');
});
test('external market lookup disabled by default and even local choices do not persist',async()=>{
 const f=inlineLedgerFixture(),source=extractVisualPortfolio(f.source);
 let calls=0;
 const resolver=async ({name})=>{
   calls++;
   return {schema_version:'instrument-resolver-v1',query:name,candidates:[
     {symbol:'ABC.XHEL',shortname:name,longname:name,quote_type:'EQUITY',
      exchange:'XHEL',currency:'USD'}]};
 };
 const raw=await suggestInstrumentListings(source,{resolver,lookupMode:'local'});
 assert.equal(calls,0,'OCR names cannot query listing resolver directly');
 assert.deepEqual(raw.issues,[{reason:'EXPLICIT_IDENTITY_REVIEW_REQUIRED'}]);
 let review=preparePortfolioIdentityReview(source,f.source);
 assert.ok(review.rows.length>0);
 for(const row of review.rows)review=chooseInstrumentIdentity(review,
   {rowId:row.rowId,decision:'confirm-observed'});
 const off=await suggestInstrumentListings(review,{resolver});
 assert.equal(calls,0);
 assert.ok(off.rows.every(x=>x.status==='not-checked'));
 const local=await suggestInstrumentListings(review,{resolver,lookupMode:'local'});
 assert.ok(calls>0);
 const s=local.rows.find(r=>r.kind==='stock'&&r.status==='suggested');
 assert.ok(s);
 const chosen=selectInstrumentListing(s,{symbol:'ABC.XHEL',exchange:'XHEL'});
 assert.equal(chosen.status,'user-selected-listing');
 assert.equal(chosen.marketVerified,false);
 assert.equal(chosen.canPersist,false);
 assert.ok(local.rows.every(r=>!r.canPersist&&!r.marketVerified));
});