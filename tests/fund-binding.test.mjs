import test from 'node:test';
import assert from 'node:assert/strict';
import {fundBindingFixture} from './fixtures/fund-binding.mjs';
import {extractFundSnapshot} from '../src/fund-snapshots.mjs';
for(const staggered of [true,false])test(`Work P1-64-01 ${staggered?'staggered attack':'aligned control'}`,()=>{
 const f=fundBindingFixture(staggered),r=extractFundSnapshot(f.source,structuredClone(f.source)),row=r.rows[0];
 assert.equal(row.fields.nav.decimal,'52.1846');
 assert.equal(row.fields.averageAcquisitionPrice.status,'missing');
 assert.equal(row.canRequestCostBasis,true);
 assert.deepEqual(r.candidates,[]);assert.deepEqual(r.actions,[]);assert.equal(r.canPersist,false);
});
