import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractVisualPortfolio} from '../src/portfolio-visual-evidence.mjs';
import {suggestInstrumentListings,selectInstrumentListing}
  from '../src/portfolio-instrument-listings.mjs';
import {visualLedgerFixture} from './fixtures/portfolio-visual-ledger.mjs';
import {preparePortfolioIdentityReview,chooseInstrumentIdentity}
  from '../src/portfolio-identity-review.mjs';

const extract=()=>{
 const f=visualLedgerFixture();
 let review=preparePortfolioIdentityReview(extractVisualPortfolio(f.source),f.source);
 for(const row of review.rows)review=chooseInstrumentIdentity(review,
   {rowId:row.rowId,decision:'confirm-observed'});
 return review;
};
const listing=(symbol,name,quoteType,exchange='XHEL',currency='EUR')=>({
  symbol,shortname:name,longname:name,quote_type:quoteType,exchange,
  exchange_display:exchange,exchange_name:'Fictional Market',currency
});
test('no external lookup without explicit session consent, and none by default',async()=>{
 const x=extract();let calls=0;
 const resolver=async () => {calls++;throw Error('should be unreachable');};
 for(const args of [{resolver},{resolver,lookupMode:'external'},
   {resolver,lookupMode:'external',approvedExternalLookup:false}]){
  const r=await suggestInstrumentListings(x,args);
  assert.equal(r.rows.length,5);
  assert.equal(calls,0);
  assert.ok(r.rows.every(a=>a.status==='not-checked'&&!a.canPersist&&!a.marketVerified));
 }
});
test('only instrument names cross lookup boundary, never shares, values, OCR or accounts',async()=>{
 const input=extract(),queries=[];
 const resolver=async data=>{
  assert.deepEqual(Object.keys(data),['name']);
  queries.push(data.name);
  assert.equal(typeof data.name,'string');
  return {schema_version:'instrument-resolver-v1',query:data.name,candidates:[
    listing('QZV.XH',data.name,'EQUITY','XHEL','USD')]};
 };
 const result=await suggestInstrumentListings(input,{resolver,lookupMode:'external',
   approvedExternalLookup:true});
 assert.equal(queries.length,5);
 assert.deepEqual(queries,input.userSelections.map(s=>s.userSelectedName));
 assert.equal(result.rows.length,5);
 assert.equal(result.rows.filter(r=>r.status==='suggested').length,4);
 assert.equal(result.rows.filter(r=>r.status==='unresolved').length,1);
 assert.ok(result.rows.every(r=>!r.marketVerified&&!r.canPersist));
});
test('stock and fund types are never silently interchangeable',async()=>{
 const input=extract();
 const resolver=async ({name})=>({
  schema_version:'instrument-resolver-v1',query:name,candidates:[
    listing('COMMON.XH',name,'EQUITY'),
    listing('MUTUAL.XH',name,'MUTUALFUND')
  ]});
 const r=await suggestInstrumentListings(input,{resolver,lookupMode:'local'});
 assert.deepEqual(r.rows.map(x=>x.matches.length),[1,1,1,1,1]);
 assert.equal(r.rows[0].matches[0].quoteType,'EQUITY');
 assert.equal(r.rows[4].matches[0].quoteType,'MUTUALFUND');
});
test('matching asset name on two exchanges needs instrument-level user choice',async()=>{
 const r=await suggestInstrumentListings(extract(),{lookupMode:'local',
  resolver:async ({name})=>({schema_version:'instrument-resolver-v1',query:name,candidates:[
    listing('QV.XH',name,'EQUITY','XHEL'),listing('QV.XN',name,'EQUITY','XNAS')
  ]})});
 assert.equal(r.rows[0].status,'ambiguous');
 assert.equal(r.rows[0].matches.length,2);
 const choice=selectInstrumentListing(r.rows[0],{symbol:'QV.XN',exchange:'XNAS'});
 assert.equal(choice.status,'user-selected-listing');
 assert.equal(choice.selection.exchange,'XNAS');
 assert.equal(choice.marketVerified,false);
 assert.equal(choice.canPersist,false);
 assert.equal(selectInstrumentListing(r.rows[0],{symbol:'UNLISTED',exchange:'XNAS'}).status,'selection-rejected');
});
test('broker valuation EUR does not falsely imply that US listing trades in EUR',async()=>{
 const r=await suggestInstrumentListings(extract(),{lookupMode:'local',
  resolver:async ({name})=>({schema_version:'instrument-resolver-v1',query:name,
    candidates:[listing('FICTION.XN',name,'EQUITY','XNAS','USD')]})});
 assert.equal(r.rows[0].status,'suggested');
 assert.equal(r.rows[0].matches[0].currency,'USD');
 assert.equal(r.rows[0].marketVerified,false);
});
test('mismatched OCR spelling is not silently replaced by a nearby ticker/name',async()=>{
 const original=extract();
 const wrong=structuredClone(original);
 wrong.userSelections[0].decision='correct-name';
 wrong.userSelections[0].userSelectedName='Ouartz Devices';
 const r=await suggestInstrumentListings(wrong,{lookupMode:'local',
  resolver:async ({name})=>({schema_version:'instrument-resolver-v1',query:name,
    candidates:[listing('QV.XH','Quartz Devices','EQUITY')]})});
 assert.equal(r.rows[0].status,'unresolved');
 assert.equal(r.rows[0].matches.length,0);
 assert.equal(r.marketVerification,'no-listing-user-confirmed');
});
test('untrusted provider schema, spoofed query or invalid venue never validates an instrument',async()=>{
 const r=await suggestInstrumentListings(extract(),{lookupMode:'local',
  resolver:async ({name})=>({
    schema_version:'instrument-resolver-v1',query:'Another name',candidates:[
      listing('ABC.XH',name,'EQUITY')]})});
 assert.ok(r.rows.every(x=>x.status==='unavailable'));
 const r2=await suggestInstrumentListings(extract(),{lookupMode:'local',
  resolver:async ({name})=>({
    schema_version:'instrument-resolver-v1',query:name,candidates:[
      listing('ABC.XH',name,'EQUITY','')]})});
 assert.ok(r2.rows.every(x=>x.status==='unresolved'));
});
test('duplicate instrument name reuses per-call lookups but retains separate source rows',async()=>{
 const x=extract();
 x.userSelections[1].decision='correct-name';
 x.userSelections[1].userSelectedName=x.userSelections[0].userSelectedName;
 let n=0;
 const resolver=async ({name})=>{n++;return {schema_version:'instrument-resolver-v1',
   query:name,candidates:[listing('DUP.XH',name,'EQUITY')]};};
 const r=await suggestInstrumentListings(x,{lookupMode:'local',resolver});
 assert.equal(n,4);
 assert.equal(r.rows.length,5);
 assert.notDeepEqual(r.rows[0].sourceIds,r.rows[1].sourceIds);
});
test('no automatic proposal from invalid source candidate or invalid market listing',async()=>{
 const x=extract();
 x.userSelections[0].assertionSource='not-a-user-choice';
 x.userSelections[1].sourceIds.quantity=[];
 const r=await suggestInstrumentListings(x,{lookupMode:'local',resolver:async()=>{
   throw Error('must never run on invalid rows');
 }});
 assert.equal(r.rows.length,3);
 assert.equal(r.issues.length,2);
 assert.ok(r.rows.every(a=>a.status==='unavailable'));
});

test('the same ticker on multiple exchanges cannot be selected without a venue',async()=>{
 const r=await suggestInstrumentListings(extract(),{lookupMode:'local',
  resolver:async ({name})=>({schema_version:'instrument-resolver-v1',query:name,candidates:[
    listing('DUP',name,'EQUITY','XHEL'),listing('DUP',name,'EQUITY','XNAS')
  ]})});
 assert.equal(r.rows[0].status,'ambiguous');
 assert.equal(selectInstrumentListing(r.rows[0],{symbol:'DUP',exchange:''}).status,'selection-rejected');
 const c=selectInstrumentListing(r.rows[0],{symbol:'DUP',exchange:'XNAS'});
 assert.equal(c.status,'user-selected-listing');
 assert.equal(c.selection.exchange,'XNAS');
 assert.equal(c.marketVerified,false);
 assert.equal(c.canPersist,false);
});

test('issue55 P0: raw OCR cannot reach external resolver even with lookup consent',async()=>{
 const f=visualLedgerFixture(),raw=extractVisualPortfolio(f.source);
 let calls=0;
 const result=await suggestInstrumentListings(raw,{
  lookupMode:'external',approvedExternalLookup:true,
  resolver:async()=>{calls++;return {schema_version:'instrument-resolver-v1',candidates:[]};}
 });
 assert.equal(calls,0);
 assert.deepEqual(result.rows,[]);
 assert.deepEqual(result.issues,[{reason:'EXPLICIT_IDENTITY_REVIEW_REQUIRED'}]);
 assert.equal(result.canPersist,false);
});
test('issue55 P0: unreviewed heading never gets sent, corrected name requires user choice',async()=>{
 const {issue55Fixture}=await import('./fixtures/issue55-name-role.mjs');
 const f=issue55Fixture({mode:'absent'}),raw=extractVisualPortfolio(f.source);
 let review=preparePortfolioIdentityReview(raw,f.source);
 const names=[];
 const resolver=async ({name})=>{
  names.push(name);
  return {schema_version:'instrument-resolver-v1',query:name,candidates:[]};
 };
 const before=await suggestInstrumentListings(review,{lookupMode:'external',
  approvedExternalLookup:true,resolver});
 assert.equal(names.length,0);
 assert.equal(before.rows.length,0);
 const first=review.rows.find(r=>r.observedText==='Growth bucket');
 review=chooseInstrumentIdentity(review,{rowId:first.rowId,
   decision:'correct-name',chosenName:'Amber Circuit'});
 const after=await suggestInstrumentListings(review,{lookupMode:'external',
  approvedExternalLookup:true,resolver});
 assert.deepEqual(names,['Amber Circuit']);
 assert.equal(after.rows.length,1);
 assert.equal(after.rows[0].name,'Amber Circuit');
 assert.equal(after.canPersist,false);
 assert.ok(!names.includes('Growth bucket'));
});
