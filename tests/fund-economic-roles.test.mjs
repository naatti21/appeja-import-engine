import test from 'node:test';
import assert from 'node:assert/strict';
import {economicRoleFixture} from './fixtures/fund-economic-roles.mjs';
import {brokerFundFixture} from './fixtures/fund-broker-structures.mjs';
import {extractFundSnapshot} from '../src/fund-snapshots.mjs';
const run=f=>extractFundSnapshot(f.source,structuredClone(f.source));
for(const mode of ['unknown-context','above-name','dated-nav','plain-nav','separate-date','dated-gav','day-change','generic-price','conflicting','unlabelled-value','return-near-value'])test('economic label role '+mode,()=>{
 const f=economicRoleFixture(mode),r=run(f);assert.equal(r.rows.length,1);const row=r.rows[0];
 assert.equal(row.fields.value.status==='observed',f.expectValue);assert.equal(row.fields.quantity.decimal,'37.6');
 if(!f.expectValue){assert.equal(row.structuralStatus,'UNRESOLVED');assert.equal(row.canRequestCostBasis,false);assert.ok(row.fields.value.labelEvidence.length);}
 assert.equal(r.canPersist,false);assert.deepEqual(r.candidates,[]);assert.deepEqual(r.actions,[]);
});
test('dated and contextual labels follow exchanged columns across five cards',()=>{
 const f=brokerFundFixture('cards');for(const o of f.source.observations){if(o.raw==='NAV')o.raw='Keskikurssi 2026-10-16';else if(o.raw==='Keskikurssi')o.raw='NAV as of 16/10/2026';}
 const r=run(f);assert.equal(r.rows.length,5);for(const [i,row] of r.rows.entries()){assert.equal(row.fields.nav.decimal,f.oracle[i].averageAcquisitionPrice);assert.equal(row.fields.averageAcquisitionPrice.decimal,f.oracle[i].nav);assert.equal(row.fields.value.decimal,f.oracle[i].value);assert.ok(row.fields.nav.labelEvidence.some(e=>e.raw.includes('as of')));}
});
test('same numeric value with conflicting economic OCR roles is not promoted',()=>{
 const f=economicRoleFixture('dated-nav'),w=structuredClone(f.source);w.observations.find(o=>o.raw.startsWith('NAV')).raw='Arvo 16.10.2026';const r=extractFundSnapshot(f.source,w);assert.equal(r.rows[0].fields.value.status,'ambiguous');assert.equal(r.rows[0].structuralStatus,'UNRESOLVED');
});
test('long economic labels retain their role when a generic price word is nested inside',()=>{
 const f=economicRoleFixture('dated-gav');f.source.observations.find(o=>o.raw.startsWith('Keskikurssi')).raw='Average acquisition price as of 2026-10-16';const row=run(f).rows[0];assert.equal(row.fields.averageAcquisitionPrice.decimal,'52.1846');assert.notEqual(row.fields.value.status,'observed');
});
