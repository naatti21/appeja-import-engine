import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScopedClaims} from '../research/scoped-context-v1/inspect.mjs';
const token=(id,raw,x=.44,y=.48,page=1)=>({id,raw,page,
  box:{x0:x,y0:y,x1:x+.08,y1:y+.016}});
function documentField(){
 const layout={observations:[token('value','3200.00'),token('header','Gross pay',.44,.20),
    token('currency','Currency: EUR',.04,.05)],issues:[],pages:[],unplacedObservations:[]};
 const field={status:'verified',semanticKey:'grossPay',value:3200,sourceIds:['value','header','currency'],
  sourceRoles:{valueIds:['value'],headerIds:['header'],contextIds:['currency']},
  scopedRoles:{header:'column',context:'documentCurrency'},context:{currency:'EUR'}};
 return {layout,fields:{grossPay:field}};
}
const run=doc=>inspectScopedClaims(doc.layout,doc.fields);
test('scoped column + explicit document currency are structural evidence, NEVER import readiness',()=>{
 const d=documentField(),before=JSON.stringify(d),r=run(d);
 assert.equal(r.scopeSupported,true);
 assert.equal(r.supported.length,1);
 assert.deepEqual(r.supported[0].header,{sourceId:'header',role:'column-heading',page:1});
 assert.equal(r.supported[0].context.currency,'EUR');
 assert.equal(r.canAutoAccept,false);assert.equal(r.canPersist,false);
 assert.equal(r.status,'review-required');
 assert.equal(r.frozenAudit.canAutoAccept,false); // old same-row gate stays blocked
 assert.equal(JSON.stringify(d),before);
});
test('holdings quantity header above cell can be scoped without guessing the instrument',()=>{
 const d=documentField();
 d.layout.observations=[token('value','8'),token('header','Quantity',.44,.2)];
 d.fields={position1:{status:'verified',semanticKey:'quantity',value:8,sourceIds:['value','header'],
  sourceRoles:{valueIds:['value'],headerIds:['header'],contextIds:[]},
  scopedRoles:{header:'column',context:'none'}}};
 const r=run(d);
 assert.equal(r.scopeSupported,true);
 assert.equal(r.supported[0].semanticKey,'quantity');assert.equal(r.canPersist,false);
});
test('value must reproduce complete source content, no extra amount or fake source ID',()=>{
 for(const mutate of [
  d=>d.layout.observations.find(o=>o.id==='value').raw='3200.00 73.21',
  d=>d.fields.grossPay.sourceIds.push('forged'),
  d=>d.fields.grossPay.sourceRoles.valueIds.push('currency'),
  d=>d.fields.grossPay.value=73.21
 ]){
  const d=documentField();mutate(d);
  const r=run(d);assert.equal(r.scopeSupported,false);
  assert.ok(r.issues.length);assert.equal(r.canPersist,false);
 }
});
test('different-page, distant, wrong-lane, wrong-name and intervening column headings block',()=>{
 const edits=[
  d=>d.layout.observations.find(o=>o.id==='header').page=2,
  d=>d.layout.observations.find(o=>o.id==='header').box={x0:.44,y0:.01,x1:.52,y1:.026},
  d=>d.layout.observations.find(o=>o.id==='header').box={x0:.8,y0:.20,x1:.88,y1:.216},
  d=>d.layout.observations.find(o=>o.id==='header').raw='Net pay',
  d=>d.layout.observations.push(token('other','Net pay',.44,.30))
 ];
 for(let i=0;i<edits.length;i++){
  const d=documentField();edits[i](d);
  const r=run(d);assert.equal(r.scopeSupported,false,'case '+i);
  assert.ok(r.issues.some(x=>x.code==='COLUMN_SCOPE_UNVERIFIED'),'case '+i);
 }
});
test('currency global claim must be explicit, singular, page-bound and matching',()=>{
 const edits=[
  d=>d.layout.observations.find(o=>o.id==='currency').raw='EUR',
  d=>d.layout.observations.find(o=>o.id==='currency').page=2,
  d=>d.layout.observations.find(o=>o.id==='currency').box={x0:.04,y0:.3,x1:.12,y1:.316},
  d=>d.layout.observations.push(token('USD','Currency: USD',.1,.08)),
  d=>d.layout.observations.push(token('EUR2','Currency: EUR',.15,.08)),
  d=>d.fields.grossPay.context.currency='USD'
 ];
 for(let i=0;i<edits.length;i++){
  const d=documentField();edits[i](d);
  const r=run(d);assert.equal(r.scopeSupported,false,'case '+i);
  assert.ok(r.issues.some(x=>x.code==='DOCUMENT_CONTEXT_UNVERIFIED'),'case '+i);
 }
});
test('page-two value cannot inherit first-page currency or column heading',()=>{
 const d=documentField();d.layout.observations.find(o=>o.id==='value').page=2;
 const r=run(d);assert.equal(r.scopeSupported,false);
 assert.ok(r.issues.length>=2);assert.equal(r.canAutoAccept,false);
});
test('document-scoped context can be shared by separate same-page values, not as value evidence',()=>{
 const d=documentField();
 d.layout.observations.push(token('net','2000.00',.75,.48),token('netHeader','Net pay',.75,.20));
 d.fields.netPay={status:'verified',semanticKey:'netPay',value:2000,sourceIds:['net','netHeader','currency'],
  sourceRoles:{valueIds:['net'],headerIds:['netHeader'],contextIds:['currency']},
  scopedRoles:{header:'column',context:'documentCurrency'},context:{currency:'EUR'}};
 const r=run(d);
 assert.equal(r.scopeSupported,true);assert.equal(r.supported.length,2);
 assert.equal(r.canAutoAccept,false);
});
test('one value source cannot claim multiple financial fields even if values match',()=>{
 const d=documentField();
 d.fields.netPay={...structuredClone(d.fields.grossPay),semanticKey:'netPay',
   sourceIds:['value','netHeading','currency'],
   sourceRoles:{valueIds:['value'],headerIds:['netHeading'],contextIds:['currency']}};
 d.layout.observations.push(token('netHeading','Net pay',.44,.14));
 const r=run(d);assert.equal(r.scopeSupported,false);
 assert.ok(r.issues.some(x=>x.code==='VALUE_SOURCE_REUSED'));
});
test('an unrelated admin number remains unclaimed and old audit stays blocked',()=>{
 const d=documentField();
 d.layout.observations.push(token('archive','Archive copy 7042',.1,.09));
 const r=run(d);
 assert.equal(r.scopeSupported,true);assert.equal(r.canPersist,false);
 assert.equal(r.frozenAudit.canAutoAccept,false);
 assert.ok(r.frozenAudit.newWarnings.some(w=>w.sourceId==='archive'));
});
test('unknown field role cannot be called Gross pay merely because geometry matches',()=>{
 const d=documentField();d.fields.grossPay.semanticKey='notARealRole';
 const r=run(d);assert.equal(r.scopeSupported,false);
 assert.ok(r.issues.some(x=>x.code==='COLUMN_SCOPE_UNVERIFIED'));
});
test('malformed and overlapping geometry fails closed without dropping source',()=>{
 const edits=[
  d=>d.layout.observations.find(o=>o.id==='value').box.x1=2,
  d=>d.layout.observations.push({...d.layout.observations[0]}),
  d=>d.layout.observations.find(o=>o.id==='header').box={...d.layout.observations[0].box},
  d=>d.fields.grossPay.scopedRoles={header:'guess',context:'documentCurrency'}
 ];
 for(const edit of edits){const d=documentField();edit(d);
  const r=run(d);assert.equal(r.scopeSupported,false);assert.equal(r.canPersist,false);
 }
});
test('input permutations preserve document currency and column evidence',()=>{
 const d=documentField(),expected=run(d);
 d.layout.observations.reverse();d.fields.grossPay.sourceIds.reverse();
 const r=run(d);assert.equal(r.scopeSupported,expected.scopeSupported);
 assert.deepEqual(r.supported,expected.supported);
});

test('upstream extraction problems or unplaced OCR observations cannot produce supported scopes',()=>{
 const changes=[
  d=>d.layout.issues.push({code:'INVALID_GEOMETRY',sourceId:'value'}),
  d=>d.layout.unplacedObservations=[{id:'badocr',raw:'99.00'}],
  d=>d.layout.issues='invalid'
 ];
 for(const change of changes){
  const d=documentField();change(d);
  const r=run(d);assert.equal(r.scopeSupported,false);
  assert.equal(r.issues[0].code,'SOURCE_READER_HAS_ISSUES');
  assert.equal(r.canPersist,false);
 }
});
