import test from 'node:test';
import assert from 'node:assert/strict';
import {extractFundSnapshot} from '../src/fund-snapshots.mjs';
import {offsetRoleFixture} from './fixtures/fund-offset-roles.mjs';
import {roleControlFixture} from './fixtures/fund-role-controls.mjs';
const run=f=>extractFundSnapshot(f.source,structuredClone(f.source));
for(const mode of ['nav','gav','left-offset','wide-font'])test('economic graph rejects offset price '+mode,()=>{
 const r=run(offsetRoleFixture(mode));assert.equal(r.rows.length,1);
 const f=r.rows[0].fields.value;assert.equal(f.status,'ambiguous');assert.equal(f.decimal,null);
 assert.ok(f.roleBinding.claims.length);for(const c of f.roleBinding.claims){assert.ok(c.label.sourceIds.length);assert.ok(c.label.normalizedText);assert.ok(c.label.box);assert.deepEqual(c.number.sourceIds,f.sourceIds);}
 assert.equal(r.rows[0].canRequestCostBasis,false);assert.equal(r.canPersist,false);assert.deepEqual(r.candidates,[]);
});
for(const mode of ['one','five','cross-conflict','cross-control'])test('economic graph card control '+mode,()=>{
 const f=roleControlFixture(mode),r=run(f);assert.equal(r.rows.length,f.oracle.length);
 for(const [i,o] of f.oracle.entries()){
  const row=r.rows[i];assert.equal(row.fields.name.raw,o.name);assert.equal(row.fields.quantity.decimal,o.quantity);
  if(o.withheld){assert.equal(row.fields.value.status,'ambiguous');assert.equal(row.fields.value.decimal,null);assert.equal(row.fields.value.reason,'CROSS_CARD_ROLE_CONFLICT');}
  else {assert.equal(row.fields.value.status,'observed');assert.equal(row.fields.value.decimal,o.value);}
 }
});
test('unbound price label blocks fallback without requiring a geometric edge',()=>{
 const f=offsetRoleFixture();const l=f.source.observations.find(o=>o.raw.startsWith('NAV'));
 l.source.box.x0=.4;l.source.box.x1=.5;
 const v=run(f).rows[0].fields.value;assert.equal(v.status,'ambiguous');assert.equal(v.reason,'UNBOUND_PRICE_LABEL_IN_CARD');
});
test('separate section headings do not replace the instrument name',()=>{
 const f=roleControlFixture('one'),n=f.source.observations.find(o=>o.raw==='Value Meadow Index');
 for(const [i,raw] of ['European funds','Accumulating classes'].entries())f.source.observations.push({...structuredClone(n),id:`heading-${i}`,raw,source:{...n.source,box:{...n.source.box,y0:n.source.box.y0-(i+1)*.035,y1:n.source.box.y1-(i+1)*.035}}});
 const row=run(f).rows[0];assert.equal(row.fields.name.raw,'Value Meadow Index');assert.deepEqual(row.fields.name.sourceIds,[n.id]);assert.equal(row.identityStatus,'UNVERIFIED');
});

test('nested unknown OCR fragments remain traceable but recognised conflicting roles still block',()=>{
 const f=roleControlFixture('one');
 // Explicit Arvo proof and a fragment from the very same source pixels.
 const value=f.source.observations.find(o=>o.raw==='2300,50 EUR');
 const label={id:'total-label',raw:'Arvo',ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:value.source.box.x0,x1:value.source.box.x0+.1,y0:.28,y1:.30}}};
 const fragment={id:'nested-fragment',raw:'XY',ocrConfidence:38,source:{format:'image-ocr',page:1,box:{x0:label.source.box.x0+.02,x1:label.source.box.x1-.02,y0:.281,y1:.282}}};
 f.source.observations.push(label,fragment);let r=run(f);
 assert.equal(r.rows[0].fields.value.status,'observed');assert.equal(r.rows[0].fields.value.decimal,'2300.50');assert.equal(r.rows[0].fields.value.roleBinding.nestedEvidence[0].sourceIds[0],fragment.id);
 fragment.raw='NAV';r=run(f);assert.notEqual(r.rows[0].fields.value.status,'observed');
});

import {buildEconomicBindings} from '../src/fund-role-binding.mjs';
test('one wide economic label cannot claim two monetary columns',()=>{
 const segment=(id,raw,x0,x1,y0,y1)=>({raw,box:{x0,x1,y0,y1},page:1,obs:[{id,raw,source:{page:1,box:{x0,x1,y0,y1}}}]});
 const lines=[segment('label','Arvo',.1,.9,.1,.12),segment('left','100,50 EUR',.1,.3,.15,.17),segment('right','42,25 EUR',.6,.8,.15,.17)];
 const graph=buildEconomicBindings(lines,[{id:'card',page:1,start:0,end:1,nameIds:[]}],s=>s==='Arvo'?'value':undefined);
 for(const id of ['left','right']){const b=graph.forNumber([id],'card');assert.equal(b.status,'ambiguous');assert.equal(b.reason,'MULTIPLE_NUMBERS_FOR_LABEL');}
});
