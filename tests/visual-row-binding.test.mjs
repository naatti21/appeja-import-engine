import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractVisualPortfolio,extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';
import {rowBindingFixture} from './fixtures/visual-row-binding.mjs';

for(const dual of [false,true])test('issue49: competing names and headings cannot become holdings, dual='+dual,()=>{
 const f=rowBindingFixture();
 const r=dual?extractVisualPortfolioCorroborated(f.source,structuredClone(f.source)):extractVisualPortfolio(f.source);
 assert.deepEqual(r.candidates.map(c=>c.fields.name.value),['Clear River']);
 assert.equal(r.unresolved.length,3);
 assert.equal(r.reconciliation.status,'not-evaluable');
 for(const u of r.unresolved){assert.equal(u.field,'name');assert.ok(u.sourceIds.length);}
 assert.equal(r.canPersist,false);
});
test('issue49: clean unknown names preserve coverage and unique source ownership',()=>{
 const f=rowBindingFixture({attack:false}),r=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
 assert.deepEqual(r.candidates.map(c=>({name:c.fields.name.value,quantity:c.fields.quantity.value,cents:c.fields.marketValue.value.cents})),f.oracle);
 const ids=r.candidates.flatMap(c=>Object.values(c.fields).flatMap(f=>f.sourceIds));
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(r.candidates.every(c=>!c.canPersist&&c.marketVerification.status==='not-verified'));
});
test('issue49: low confidence competing text must not disappear from semantic conflict detection',()=>{
 const f=rowBindingFixture();
 f.source.observations.filter(o=>f.oracle.some(r=>r.name===o.raw)).forEach(o=>o.ocrConfidence=5);
 assert.equal(extractVisualPortfolio(f.source).candidates.length,0);
});
test('issue49: page transitions cannot inherit an open holdings section',()=>{
 const f=rowBindingFixture({attack:false});
 const copies=f.source.observations.filter(o=>o.raw==='Clear River'||o.raw==='13 kpl'||o.raw==='409,00 EUR').map((o,i)=>({...structuredClone(o),id:'page2-'+i,source:{...structuredClone(o.source),page:2}}));
 for(const o of copies){o.source.box.y0+=.12;o.source.box.y1+=.12;}
 f.source.observations.push(...copies);
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,4);
});
test('issue49: an intervening unreadable quantity cannot donate its name or value to next row',()=>{
 const f=rowBindingFixture({attack:false});
 const q=f.source.observations.find(o=>o.raw==='12 kpl');q.ocrConfidence=5;
 const next=f.source.observations.find(o=>o.raw==='7 kpl');
 next.source.box.y0=q.source.box.y0+.02;next.source.box.y1=q.source.box.y1+.02;
 const r=extractVisualPortfolio(f.source);
 assert.ok(!r.candidates.some(c=>c.fields.quantity.value===7));
});
test('issue49: heading above a real name must also remain unresolved',()=>{
 const f=rowBindingFixture();
 for(let i=0;i<3;i++){
  const name=f.source.observations.find(o=>o.raw===f.oracle[i].name);
  const heading=f.source.observations.find(o=>o.raw===f.headings[i]);
  [name.source.box,heading.source.box]=[heading.source.box,name.source.box];
 }
 assert.deepEqual(extractVisualPortfolio(f.source).candidates.map(c=>c.fields.name.value),['Clear River']);
});

test('issue49: two quantity anchors on one row cannot silently select the first',()=>{
 const f=rowBindingFixture({attack:false});
 f.source.observations.find(o=>o.raw==='12 kpl').raw='12 kpl 99 kpl';
 const r=extractVisualPortfolio(f.source);
 assert.equal(r.candidates.length,3);
 assert.ok(r.unresolved.some(u=>u.field==='quantity'));
});
test('issue49: conflict references remain valid and source text/geometry is never rewritten',()=>{
 const f=rowBindingFixture(),before=structuredClone(f.source);
 const r=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
 assert.deepEqual(f.source,before);
 for(const u of r.unresolved)for(const id of u.sourceIds)
  assert.ok(f.source.observations.some(o=>o.id===id));
 for(let i=0;i<3;i++){
  const name=f.source.observations.find(o=>o.raw===f.oracle[i].name);
  const heading=f.source.observations.find(o=>o.raw===f.headings[i]);
  assert.ok(r.unresolved.some(u=>u.sourceIds.includes(name.id)&&u.sourceIds.includes(heading.id)));
 }
});
