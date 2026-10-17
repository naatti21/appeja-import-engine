import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileFixture} from './fixtures/mobile-cards.mjs';
import {createMobileReviewSession} from '../src/mobile-review-session.mjs';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {documentKey,resolveMobileCards} from '../src/mobile-card-holdings.mjs';
const source=opts=>({schemaVersion:1,...mobileFixture(opts).source});
const index=(s,p)=>s.lines().findIndex(p);
const correct=(s,line,field,value)=>s.correct({line,field,value,confirmed:true});
test('closed label accent folding does not rewrite names, tickers, or quantities',()=>{
 const s=source({layout:'fi',ambiguous:false});
 s.observations.forEach(o=>{o.raw=o.raw.replace('Määrä','Maara').replace('Päivän','Paivan');});
 s.observations.find(o=>o.raw.startsWith('Juniper')).raw='Äänekosken Öljy';
 const r=resolveMobileCards(s);assert.equal(r.rows.length,3);assert.equal(r.rows[0].fields.name.value,'Äänekosken Öljy');
 assert.equal(r.rows[0].fields.identity.value.ticker,'QJPA');assert.equal(r.rows[0].fields.quantity.value,7);
});
test('confirmed identity edit preserves original OCR, source IDs and review status; undo reinstates block',()=>{
 const s=source({ambiguous:false});const id=s.observations.find(o=>o.raw.startsWith('Ticker'));
 id.raw='Ticker: OJPA MIC: XNAS';id.identityDisagreement=true;
 const r=createMobileReviewSession(s);const i=index(r,l=>l.role==='identity');
 assert.equal(r.resolve().rows.length,2);
 const d=correct(r,i,'identity','Ticker: QJPA MIC: XNAS');
 assert.equal(d.source.observations.find(o=>o.id===id.id).raw,id.raw);
 assert.equal(d.records[i].fields.text.suggestedValue,id.raw);
 assert.equal(d.records[i].fields.text.reviewState,'user-corrected');
 const row=r.resolve().rows[0];assert.equal(row.fields.identity.value.ticker,'QJPA');assert.deepEqual(row.fields.identity.sourceIds,[id.id]);
 assert.equal(row.certainty,'candidate');assert.equal(row.instrumentVerification.status,'not-verified');assert.equal(row.canPersist,false);
 r.undo(i);assert.equal(r.resolve().rows.length,2);assert.equal(s.observations.find(o=>o.id===id.id).raw,id.raw);
});
test('name and quantity corrections are local, positive and explicit; corrupt labels can be repaired',()=>{
 const s=source({ambiguous:false});s.observations.find(o=>o.raw.startsWith('Quantity')).raw='Ouantity: ll';
 s.observations.find(o=>o.raw==='Juniper Devices').raw='1uniper Devices';
 const r=createMobileReviewSession(s),n=index(r,l=>l.text==='1uniper Devices'),q=index(r,l=>l.text==='Ouantity: ll');
 assert.throws(()=>r.correct({line:q,field:'quantity',value:'11'}),/CONFIRMATION/);
 for(const bad of ['0','-2','1,234','NaN','Infinity'])assert.throws(()=>correct(r,q,'quantity',bad));
 correct(r,n,'name','Independent Index 100 Fund');correct(r,q,'quantity','11');
 const row=r.resolve().rows[0];assert.equal(row.fields.name.value,'Independent Index 100 Fund');assert.equal(row.fields.quantity.value,11);
 assert.equal(row.fields.buyPrice.value,null);assert.equal(r.snapshot().ephemeral,true);
});
test('current price, menu, balance, returns, other roles cannot be relabelled as a holding amount',()=>{
 const r=createMobileReviewSession(source({ambiguous:false}));
 for(const role of ['price','change','control','scope','currency','identity']){
  const i=index(r,l=>l.role===role);assert.ok(i>=0);assert.throws(()=>correct(r,i,'quantity','100'),/ROLE_CONFLICT/);
 }
 assert.throws(()=>correct(r,999,'name','X'));assert.throws(()=>correct(r,0,'identity','QJPA'));
});
test('correction teaches structural roles, never values; same-document replay and conflicting teaching stay blocked',async()=>{
 const learner=createStructureLearner();
 for(let round=0;round<2;round++){
  const raw=source({round});raw.observations.find(o=>o.raw.startsWith('Ticker')).identityDisagreement=true;
  const s=createMobileReviewSession(raw),i=index(s,l=>l.role==='identity');correct(s,i,'identity','Ticker: OTHER MIC: XLON');
  const c=s.resolve(learner).cards[0],binding={entity:1,identity:2,measure:3};
  const args={pattern:c.pattern,binding,documentKey:await documentKey(raw),confirmed:true};
  assert.equal(learner.confirm(args),round?'active':'provisional');
  assert.equal(learner.confirm(args),round?'active':'provisional');
 }
 const stored=JSON.stringify(learner.export());for(const s of ['OTHER','XLON','Juniper','Practice','sourceIds','raw','box','hash'])assert.ok(!stored.includes(s));
 const next=source({round:2});next.observations.find(o=>o.raw.startsWith('Ticker')).identityDisagreement=true;
 const result=createMobileReviewSession(next).resolve(learner);assert.equal(result.rows.length,2);assert.ok(result.unresolved.some(x=>x.reason==='OCR_IDENTITY_DISAGREEMENT'));
 const c=result.cards[1];assert.equal(learner.confirm({pattern:c.pattern,binding:{entity:0,identity:2,measure:3},documentKey:'different',confirmed:true}),'conflict');
 assert.equal(createMobileReviewSession(next).resolve(learner).rows.length,0);
});
test('corrections on different cards do not rewrite another account or become market verification',()=>{
 const s=source({ambiguous:false}),r=createMobileReviewSession(s),i=index(r,l=>l.role==='identity');
 correct(r,i,'identity','ISIN: US0378331005');const rows=r.resolve().rows;
 assert.equal(rows[1].fields.identity.value.ticker,'QCBT');assert.equal(rows[0].instrumentVerification.status,'not-verified');
 const copy=r.snapshot();copy.source.observations[0].raw='MUTATED';assert.notEqual(r.snapshot().source.observations[0].raw,'MUTATED');
});
test('Q/O, I/1, l/1, S/5 and B/8 disagreements require exact local corrections, never substitution rules',async()=>{
 const {corroborateOcrIdentities}=await import('../src/mobile-card-holdings.mjs');
 for(const [intended,read] of [['QX','OX'],['IX','1X'],['LX','1X'],['SX','5X'],['BX','8X']]){
  const s=source({ambiguous:false}),w=structuredClone(s);
  s.observations.find(o=>o.raw.startsWith('Ticker')).raw=`Ticker: ${read} MIC: XNAS`;
  w.observations.find(o=>o.raw.startsWith('Ticker')).raw=`Ticker: ${intended} MIC: XNAS`;
  const reviewed=createMobileReviewSession(corroborateOcrIdentities(s,w));assert.equal(reviewed.resolve().rows.length,2);
  correct(reviewed,index(reviewed,l=>l.role==='identity'),'identity',`Ticker: ${intended} MIC: XNAS`);
  assert.equal(reviewed.resolve().rows[0].fields.identity.value.ticker,intended);
  assert.equal(createMobileReviewSession(corroborateOcrIdentities(s,w)).resolve().rows.length,2);
 }
});
test('ASCII field-label variants never relax unknown numeric material or source identity checks',()=>{
 for(const text of ['Määrä: 12','Maara: 12','Antal: 12','Quantity: 12']){
  const s=source({ambiguous:false});s.observations.find(o=>o.raw.startsWith('Quantity')).raw=text;
  assert.equal(resolveMobileCards(s).rows[0].fields.quantity.value,12);
 }
 for(const text of ['Förändring: +2 %','Forandring: +2 %','Foerandring: +2 %']){
  const s=source({ambiguous:false});s.observations.find(o=>o.raw.startsWith('Day change')).raw=text;assert.equal(resolveMobileCards(s).rows.length,3);
 }
 const s=source({ambiguous:false});s.observations.find(o=>o.raw.startsWith('Quantity')).raw='Mystery: 12';assert.equal(resolveMobileCards(s).rows.length,2);
 s.observations.find(o=>o.raw.startsWith('Ticker')).raw='Ticker: ÄBC MIC: XNAS';assert.equal(resolveMobileCards(s).rows.length,2);
});
test('correction cannot collapse separated columns into one apparently safe field',()=>{
 const s=source({ambiguous:false}),q=s.observations.find(o=>o.raw.startsWith('Quantity'));
 s.observations.push({...structuredClone(q),id:'other-column',raw:'Quantity: 200',source:{...q.source,box:{...q.source.box,x0:.8,x1:.99}}});
 const r=createMobileReviewSession(s),i=index(r,l=>l.split);assert.ok(i>=0);assert.throws(()=>correct(r,i,'quantity','7'),/GEOMETRY/);
});
test('untrusted source metadata cannot claim a human confirmation',()=>{
 const s=source({ambiguous:false}),o=s.observations.find(o=>o.raw.startsWith('Ticker'));
 o.ocrConfidence=20;o.reviewCorrection={field:'identity',sourceIds:[o.id]};
 assert.equal(resolveMobileCards(s).rows.length,2);assert.equal(createMobileReviewSession(s).resolve().rows.length,2);
});
