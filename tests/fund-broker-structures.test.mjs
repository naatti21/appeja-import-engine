import test from 'node:test';
import assert from 'node:assert/strict';
import {brokerFundFixture} from './fixtures/fund-broker-structures.mjs';
import {fundBindingFixture} from './fixtures/fund-binding.mjs';
import {extractFundSnapshot} from '../src/fund-snapshots.mjs';
const run=f=>extractFundSnapshot(f.source,structuredClone(f.source));
function exclusive(result){
 const ids=new Set();for(const row of result.rows)for(const key of ['quantity','value','nav','averageAcquisitionPrice']){
  const f=row.fields[key];if(f.status!=='observed')continue;
  for(const e of f.evidence.filter(e=>/\d/.test(e.raw))){assert.ok(!ids.has(e.sourceId),'financial source used more than once');ids.add(e.sourceId);}
 }
}
for(const layout of ['compact','cards'])test('fictional broker structure '+layout,()=>{
 const f=brokerFundFixture(layout),r=run(f);assert.equal(r.documentRole,'CURRENT_HOLDINGS_SNAPSHOT');assert.equal(r.rows.length,f.oracle.length);
 for(const [i,row] of r.rows.entries()){
  assert.equal(row.fields.name.raw,f.oracle[i].name);
  for(const key of ['quantity','value','nav','averageAcquisitionPrice'])assert.equal(row.fields[key].decimal,f.oracle[i][key],key);
  assert.equal(row.structuralStatus,'OBSERVED_ROW_REQUIRES_IDENTITY_REVIEW');assert.equal(row.canRequestCostBasis,layout==='compact');
 }
 exclusive(r);assert.equal(r.canPersist,false);assert.deepEqual(r.candidates,[]);assert.deepEqual(r.actions,[]);
});
test('unlabelled compact price is unique, not a receipt or an arbitrary heading',()=>{
 for(const heading of ['Ostokuitti','Saldo','Säästötilit']){const f=brokerFundFixture();f.source.observations[1].raw=heading;assert.equal(run(f).rows.length,0);}
 const f=brokerFundFixture(),price=f.source.observations.find(o=>o.raw==='2300,50 EUR');f.source.observations.push({...structuredClone(price),id:'second-price',raw:'52,1846 EUR',source:{...price.source,box:{...price.source.box,y0:price.source.box.y0+.01,y1:price.source.box.y1+.01}}});assert.notEqual(run(f).rows[0].fields.value.status,'observed');
});
test('missing card GAV, exchanged labels and distant columns never reuse price evidence',()=>{
 const f=brokerFundFixture('cards');f.source.observations=f.source.observations.filter(o=>o.raw!=='41,6258 EUR');const r=run(f);assert.equal(r.rows[0].fields.averageAcquisitionPrice.status,'missing');assert.equal(r.rows[0].canRequestCostBasis,true);assert.equal(r.rows[1].fields.averageAcquisitionPrice.decimal,'42.6258');exclusive(r);
 const g=brokerFundFixture('cards');for(const o of g.source.observations){if(o.raw==='NAV')o.raw='Keskikurssi';else if(o.raw==='Keskikurssi')o.raw='NAV';}const swapped=run(g);assert.equal(swapped.rows[0].fields.nav.decimal,'41.6258');assert.equal(swapped.rows[0].fields.averageAcquisitionPrice.decimal,'52.1846');exclusive(swapped);
});
test('duplicate IDs, witness numeric disagreement and foreign page stay unresolved',()=>{
 const f=brokerFundFixture('cards'),b=structuredClone(f.source);b.observations.find(o=>o.raw==='31,25 kpl').raw='3125 kpl';assert.equal(extractFundSnapshot(f.source,b).rows[0].fields.quantity.status,'ambiguous');
 f.source.observations.push(f.source.observations.at(-1));assert.equal(run(f).rows.length,0);
 const g=brokerFundFixture();g.source.observations.find(o=>o.raw==='37,6 kpl').source.page=2;assert.equal(run(g).rows.length,0);
});
test('overlapping label regions with one price cannot make two observed financial roles',()=>{
 for(const dx of [0,25,75,140,400])for(const dy of [-25,0,10,25,60]){
  const f=fundBindingFixture(),gav=f.source.observations.find(o=>o.raw==='Keskihankintahinta');gav.source.box.x0+=dx/1100;gav.source.box.x1+=dx/1100;gav.source.box.y0+=dy/1000;gav.source.box.y1+=dy/1000;exclusive(run(f));
 }
});
test('exclusive financial source ownership blocks overlapping two-role claims',()=>{
 const f=fundBindingFixture(),set=(raw,box)=>{f.source.observations.find(o=>o.raw===raw).source.box=box;};
 set('NAV',{x0:.4,x1:.401,y0:.35,y1:.42});
 set('Keskihankintahinta',{x0:.46,x1:.52,y0:.37,y1:.405});
 set('52,1846 EUR',{x0:.436,x1:.52,y0:.43,y1:.45});
 const row=run(f).rows[0];for(const k of ['nav','averageAcquisitionPrice']){assert.equal(row.fields[k].status,'ambiguous');assert.equal(row.fields[k].reason,'SOURCE_REUSED_ACROSS_FINANCIAL_FIELDS');assert.equal(row.fields[k].decimal,null);}
});
test('one name region cannot silently support a second unlabelled quantity card',()=>{
 const f=brokerFundFixture(),unit=f.source.observations.find(o=>o.raw==='37,6 kpl');
 f.source.observations.push({...structuredClone(unit),id:'extra-quantity',raw:'12,5 kpl',source:{...unit.source,box:{...unit.source.box,y0:unit.source.box.y0+.055,y1:unit.source.box.y1+.055}}});
 const result=run(f);assert.ok(result.rows.every(r=>r.fields.name.status==='ambiguous'));assert.ok(result.rows.every(r=>r.structuralStatus==='UNRESOLVED'));
});
