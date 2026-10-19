import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issue55Fixture} from './fixtures/issue55-name-role.mjs';
import {extractVisualPortfolio} from '../src/portfolio-visual-evidence.mjs';
import * as identity from '../src/portfolio-identity-review.mjs';
import {suggestInstrumentListings,selectInstrumentListing} from '../src/portfolio-instrument-listings.mjs';
function prepared(){const f=issue55Fixture({mode:'absent'});return identity.preparePortfolioIdentityReview(extractVisualPortfolio(f.source),f.source);}
function chosen(){const r=prepared();return identity.chooseInstrumentIdentity(r,{rowId:r.rows[0].rowId,decision:'correct-name',chosenName:'Amber Circuit'});}
for(const mode of ['clone','json','mutate'])test('reject forged review '+mode,async()=>{
 const original=chosen();const r=mode==='clone'?structuredClone(original):mode==='json'?JSON.parse(JSON.stringify(original)):original;
 if(mode==='mutate')r.userSelections[0].userSelectedName='Growth bucket';
 let calls=0;const out=await suggestInstrumentListings(r,{lookupMode:'external',approvedExternalLookup:true,resolver:async()=>{calls++;return {};}});
 assert.equal(calls,0);assert.deepEqual(out.rows,[]);
});
test('old revision cannot choose another row or issue a lookup',async()=>{
 const r=prepared();identity.chooseInstrumentIdentity(r,{rowId:r.rows[0].rowId,decision:'exclude-row'});
 assert.equal(identity.chooseInstrumentIdentity(r,{rowId:r.rows[1].rowId,decision:'confirm-observed'}).status,'rejected');
});
test('cancel and undo revoke choices without rewriting OCR',async()=>{
 let r=chosen();const old=r;r=identity.undoInstrumentIdentity(r,r.rows[0].rowId);
 assert.equal(r.userSelections.length,0);assert.equal(r.rows[0].observedText,'Growth bucket');
 let calls=0;const args={lookupMode:'local',resolver:async()=>{calls++;return {};}};
 await suggestInstrumentListings(old,args);identity.cancelPortfolioIdentityReview(r);await suggestInstrumentListings(r,args);
 assert.equal(calls,0);
});
test('duplicate lookup and cancellation during response do not produce stale listings',async()=>{
 const r=chosen();let calls=0,release;
 const args={lookupMode:'local',resolver:()=>{calls++;return new Promise(resolve=>{release=resolve;});}};
 const a=suggestInstrumentListings(r,args),b=suggestInstrumentListings(r,args);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
 identity.cancelPortfolioIdentityReview(r);release({schema_version:'instrument-resolver-v1',candidates:[]});
 assert.deepEqual((await a).rows,[]);assert.deepEqual((await b).rows,[]);
});
test('forged listing cannot be selected',()=>{
 assert.equal(selectInstrumentListing({status:'suggested',matches:[{symbol:'FAKE',exchange:'XHEL'}],sourceIds:[]},{symbol:'FAKE',exchange:'XHEL'}).status,'selection-rejected');
});
test('cross-page crop ambiguity blocks row',()=>{
 const f=issue55Fixture();const raw=extractVisualPortfolio(f.source);
 const id=raw.candidates[0].fields.quantity.sourceIds[0];f.source.observations.find(o=>o.id===id).source.page=2;
 const r=identity.preparePortfolioIdentityReview(raw,f.source);assert.equal(r.rows.length,2);
});
test('reviewed spelling and duplicate names use real choices, never imported selections',async()=>{
 let r=prepared();r=identity.chooseInstrumentIdentity(r,{rowId:r.rows[0].rowId,decision:'correct-name',chosenName:'Unseen Nebula'});
 r=identity.chooseInstrumentIdentity(r,{rowId:r.rows[1].rowId,decision:'correct-name',chosenName:'Unseen Nebula'});
 let calls=0;const out=await suggestInstrumentListings(r,{lookupMode:'local',resolver:async({name})=>{calls++;return {schema_version:'instrument-resolver-v1',query:name,candidates:[{symbol:'OTHER',exchange:'XHEL',quote_type:'EQUITY',shortname:'Different name'}]};}});
 assert.equal(calls,1);assert.equal(out.rows.length,2);assert.ok(out.rows.every(row=>row.status==='unresolved'&&row.matches.length===0));
 assert.notDeepEqual(out.rows[0].sourceIds,out.rows[1].sourceIds);
});
test('only requested reviewed row is queried and a wrong row cannot borrow its approval',async()=>{
 const r=chosen(),calls=[];const args={lookupMode:'local',resolver:async p=>{calls.push(p);return {schema_version:'instrument-resolver-v1',candidates:[]};}};
 await suggestInstrumentListings(r,{...args,rowId:r.rows[1].rowId});assert.deepEqual(calls,[]);
 await suggestInstrumentListings(r,{...args,rowId:r.rows[0].rowId});assert.deepEqual(calls,[{name:'Amber Circuit'}]);
});
test('custom serialization cannot disguise a changed selection',async()=>{
 const r=chosen(),snapshot=structuredClone(r);
 r.userSelections[0].userSelectedName='Growth bucket';r.toJSON=()=>snapshot;
 let calls=0;await suggestInstrumentListings(r,{lookupMode:'local',resolver:async()=>{calls++;return {};}});
 assert.equal(calls,0);
});
test('accessor cannot change a query between validation and use',async()=>{
 const r=chosen();let reads=0;
 Object.defineProperty(r.userSelections[0],'userSelectedName',{enumerable:true,get:()=>++reads===1?'Amber Circuit':'Growth bucket'});
 let calls=0;await suggestInstrumentListings(r,{lookupMode:'external',approvedExternalLookup:true,resolver:async()=>{calls++;return {};}});
 assert.equal(calls,0);assert.equal(reads,0);
});
test('source ID punctuation cannot make a different row share lookup authorization',async()=>{
 const f=issue55Fixture(),raw=extractVisualPortfolio(f.source);
 const a=raw.candidates[0].fields.name,b=raw.candidates[1].fields.name;
 f.source.observations.find(o=>o.id===a.sourceIds[0]).id='first,second';a.sourceIds=['first,second'];
 const word=f.source.observations.find(o=>o.id===b.sourceIds[0]);word.id='first';word.raw='Copper';
 f.source.observations.push({...structuredClone(word),id:'second',raw:'Harbor'});b.sourceIds=['first','second'];
 let r=identity.preparePortfolioIdentityReview(raw,f.source);
 for(const row of r.rows.slice(0,2))r=identity.chooseInstrumentIdentity(r,{rowId:row.rowId,decision:'confirm-observed'});
 const calls=[];await suggestInstrumentListings(r,{rowId:r.rows[0].rowId,lookupMode:'local',resolver:async p=>{calls.push(p.name);return {schema_version:'instrument-resolver-v1',candidates:[]};}});
 assert.deepEqual(calls,['Amber Circuit']);
});
test('old file row identifier cannot confirm an identical newly loaded file',()=>{
 const old=prepared(),next=prepared();
 const result=identity.chooseInstrumentIdentity(next,{rowId:old.rows[0].rowId,decision:'confirm-observed'});
 assert.equal(result.status,'rejected');
});
