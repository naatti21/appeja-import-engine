import test from 'node:test';
import assert from 'node:assert/strict';
import {fundSnapshotFixture} from './fixtures/fund-snapshots.mjs';
import {extractFundSnapshot,parseDisplayedDecimal,combineFundSnapshots} from '../src/fund-snapshots.mjs';
const run=f=>extractFundSnapshot(f.source,structuredClone(f.source));
for(const layout of ['compact','cards'])test('fund snapshot contract '+layout,()=>{
 const f=fundSnapshotFixture(layout),r=run(f);assert.equal(r.documentRole,'CURRENT_HOLDINGS_SNAPSHOT');assert.equal(r.canPersist,false);assert.deepEqual(r.candidates,[]);assert.equal(r.rows.length,f.oracle.length);
 for(const [i,row] of r.rows.entries()){
  for(const key of ['quantity','value','nav','averageAcquisitionPrice']){
   const field=row.fields[key];assert.equal(field.status,f.oracle[i][key]===null?'missing':'observed',key);assert.equal(field.decimal,f.oracle[i][key],key);
   if(field.status==='observed'){assert.ok(field.sourceIds.length);assert.ok(field.evidence.every(e=>e.raw&&e.box));assert.ok(field.witnessEvidence.length);}
  }
  assert.equal(row.fields.name.raw,f.oracle[i].name);assert.equal(row.identityStatus,'UNVERIFIED');assert.equal(row.canRequestCostBasis,layout==='compact');assert.equal(row.canPersist,false);
 }
});
test('strict decimals preserve display precision and reject unsafe suffixes',()=>{
 for(const [s,d,p] of [['49,7','49.7',1],['21.25','21.25',2],['1 234,5678','1234.5678',4]])assert.deepEqual(parseDisplayedDecimal(s),{decimal:d,displayPrecision:p,possiblyRounded:true});
 for(const s of ['-4','0','1,2.3','12..4','1,234,5','5 %','15.10.2026','12 EUR','Infinity','1e5','1.234','1,234'])assert.equal(parseDisplayedDecimal(s),null,s);
});
test('receipt or absent role never interpreted as snapshot',()=>{
 for(const title of ['Ostokuitti','Rahastot']){const f=fundSnapshotFixture();f.source.observations[1].raw=title;const r=run(f);assert.equal(r.documentRole,'UNKNOWN_DOCUMENT_ROLE');assert.equal(r.rows.length,0);}
 const f=fundSnapshotFixture();f.source.observations.push({...f.source.observations[0],id:'receipt',raw:'Ostokuitti'});assert.equal(run(f).documentRole,'UNKNOWN_DOCUMENT_ROLE');
});
test('OCR disagreement, duplicate IDs and invalid geometry stay blocked',()=>{
 const f=fundSnapshotFixture(),b=structuredClone(f.source);b.observations.find(o=>o.raw.includes('49,7')).raw='497 kpl';assert.equal(extractFundSnapshot(f.source,b).rows[0].fields.quantity.status,'ambiguous');
 for(const mutate of [s=>s.observations.push(s.observations[0]),s=>s.observations[5].source.box.x0=-1]){const f=fundSnapshotFixture();mutate(f.source);assert.equal(run(f).rows.length,0);}
});
test('headings, truncated names, percent quantities and price labels are not identities',()=>{
 for(const text of ['Growth bucket','Juniper...']){const f=fundSnapshotFixture();f.source.observations.find(o=>o.raw==='Juniper Horizon Sustainable').raw=text;const r=run(f);assert.deepEqual(r.candidates,[]);assert.equal(r.rows[0].identityStatus,'UNVERIFIED');}
 const f=fundSnapshotFixture();f.source.observations.find(o=>o.raw.includes('49,7')).raw='49,7 %';assert.equal(run(f).rows[0].fields.quantity.status,'ambiguous');assert.equal(run(f).rows[0].canRequestCostBasis,false);
});
test('missing one card price never borrows neighboring price; conflicting labels ambiguous',()=>{
 const f=fundSnapshotFixture('cards');f.source.observations=f.source.observations.filter(o=>o.raw!=='35,5678 EUR');assert.notEqual(run(f).rows[0].fields.averageAcquisitionPrice.status,'observed');assert.equal(run(f).rows[1].fields.averageAcquisitionPrice.decimal,'36.5678');
 const g=fundSnapshotFixture('cards');g.source.observations.find(o=>o.raw==='NAV').raw='Keskihankintahinta';assert.equal(run(g).rows[0].fields.averageAcquisitionPrice.status,'ambiguous');
});
test('overlap, same name different account and partial images never produce merge/delete actions',()=>{
 const a=run(fundSnapshotFixture()),f=fundSnapshotFixture();f.source.observations.find(o=>o.raw.includes('TEST-A')).raw='Tili: TEST-B';
 const result=combineFundSnapshots([a,a,run(f)]);assert.deepEqual(result.actions,[]);assert.equal(result.canPersist,false);assert.equal(result.documents.length,2);assert.equal(result.matchingStatus,'REQUIRES_ACCOUNT_AND_IDENTITY_REVIEW');assert.equal(result.coverage,'PARTIAL_OR_UNKNOWN');
});
test('price columns exchanged geometrically follow labels, not fixed NAV/GAV offsets',()=>{
 const f=fundSnapshotFixture('cards');for(const o of f.source.observations){if(o.raw==='NAV')o.raw='Keskihankintahinta';else if(o.raw==='Keskihankintahinta')o.raw='NAV';}
 const r=run(f);for(const [i,row] of r.rows.entries()){assert.equal(row.fields.nav.decimal,f.oracle[i].averageAcquisitionPrice);assert.equal(row.fields.averageAcquisitionPrice.decimal,f.oracle[i].nav);}
});
test('unrecognized ISIN, extra heading or currency conflict cannot promote an identity',()=>{
 const f=fundSnapshotFixture();f.source.observations.find(o=>o.raw==='Index').raw='ISIN: FI000000000?';assert.equal(run(f).rows[0].fields.name.status,'ambiguous');assert.deepEqual(run(f).candidates,[]);
 const g=fundSnapshotFixture('cards');g.source.observations.find(o=>o.raw==='35,5678 EUR').raw='35,5678 USD';const row=run(g).rows[0];assert.equal(row.fields.currency.status,'ambiguous');assert.equal(row.structuralStatus,'UNRESOLVED');
});
test('missing OCR card does not shift field binding to next card',()=>{
 const f=fundSnapshotFixture('cards'),w=structuredClone(f.source);w.observations=w.observations.filter(o=>o.source.box.y0>600/f.height||o.source.box.y0<180/f.height);
 const r=extractFundSnapshot(f.source,w);assert.equal(r.rows[0].fields.quantity.status,'ambiguous');assert.equal(r.rows[1].fields.quantity.decimal,'22.25');assert.equal(r.rows[4].fields.quantity.decimal,'25.25');
});
test('separate files with identical visible content remain separate account-unresolved documents',()=>{
 const f=fundSnapshotFixture(),a=run(f),b=run(f);assert.equal(combineFundSnapshots([a,b]).documents.length,2);assert.deepEqual(combineFundSnapshots([a,b]).actions,[]);
});
test('document source contains original account context; no learned profile or external verification',()=>{
 const r=run(fundSnapshotFixture());assert.ok(r.sourceEvidence.some(e=>e.raw==='Tili: TEST-A'));assert.equal(r.marketIdentityVerified,false);assert.equal(r.requiresReview,true);assert.equal(r.coverage,'PARTIAL_OR_UNKNOWN');
});
test('a displaced price in another card creates a conflict, not a silently chosen first value',()=>{
 const f=fundSnapshotFixture('cards'),price=f.source.observations.find(o=>o.raw==='35,5678 EUR'),second=f.source.observations.find(o=>o.raw==='36,5678 EUR');
 price.source.box={...second.source.box,y0:second.source.box.y0+.017,y1:second.source.box.y1+.017};
 const r=run(f);assert.notEqual(r.rows[0].fields.averageAcquisitionPrice.status,'observed');assert.equal(r.rows[1].fields.averageAcquisitionPrice.status,'ambiguous');assert.equal(r.rows[1].fields.averageAcquisitionPrice.reason,'MULTIPLE_VALUES_IN_FIELD_REGION');
});
test('malformed or foreign-format source cannot create a fund observation',()=>{
 for(const mutation of [s=>s.observations.push(null),s=>s.observations[0].source.format='pdf',s=>s.observations[0].id='']){const f=fundSnapshotFixture();mutation(f.source);assert.equal(run(f).rows.length,0);}
});
test('fund observations cannot bypass the existing current-review listing gate',async()=>{
 const {suggestInstrumentListings}=await import('../src/portfolio-instrument-listings.mjs');let calls=0;
 const result=await suggestInstrumentListings(run(fundSnapshotFixture()),{lookupMode:'local',resolver:async()=>{calls++;return {};}});assert.equal(calls,0);assert.deepEqual(result.rows,[]);assert.equal(result.canPersist,false);
});
