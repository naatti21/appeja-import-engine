import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {resolveMobileCards,documentKey} from '../src/mobile-card-holdings.mjs';
import {mobileFixture} from './fixtures/mobile-cards.mjs';
async function teach(l,f,entity=1){const card=resolveMobileCards(f.source,l).cards.find(c=>c.teachable);assert.ok(card);return l.confirm({pattern:card.pattern,binding:{entity,identity:card.pattern.indexOf('identity'),measure:card.pattern.indexOf('measure')},documentKey:await documentKey(f.source),confirmed:true});}
for(const layout of ['en','fi'])test(`${layout}: independent third import improves without learning names or values`,async()=>{
 const learner=createStructureLearner();
 const a=mobileFixture({layout}),b=mobileFixture({layout,round:1}),c=mobileFixture({layout,round:2});
 assert.equal(resolveMobileCards(a.source,learner).rows.length,0);
 assert.equal(await teach(learner,a),'provisional');assert.equal(resolveMobileCards(b.source,learner).rows.length,0);
 assert.equal(await teach(learner,b),'active');
 const result=resolveMobileCards(c.source,learner);assert.equal(result.unresolved.length,0);assert.equal(result.rows.length,3);
 result.rows.forEach((r,i)=>{assert.equal(r.fields.name.value,c.oracle[i].name);assert.equal(r.fields.quantity.value,c.oracle[i].qty);assert.equal(r.fields.identity.value.ticker,c.oracle[i].ticker);assert.equal(r.fields.account.value,'Practice-A');assert.equal(r.fields.buyPrice.value,null);assert.equal(r.canPersist,false);
  for(const f of Object.values(r.fields)) for(const id of f.sourceIds) assert.ok(c.source.observations.some(o=>o.id===id));
 });
 assert.ok(!JSON.stringify(learner.export()).includes(c.oracle[0].ticker));
 console.log(JSON.stringify({layout,heldOutRows:3,correct:3,falseProposals:0,unresolved:0,teachingFieldSelectionsByImport:[3,3,0],reviewStillRequired:true}));
});
test('clear labelled cards work without learning; price never becomes cost',()=>{
 const f=mobileFixture({ambiguous:false});const result=resolveMobileCards(f.source);
 assert.equal(result.rows.length,3);assert.equal(result.canPersist,false);
 assert.ok(result.rows.every(r=>r.fields.buyPrice.value===null));
});
test('low OCR, ambiguous number, missing identity, unknown material and bad geometry abstain',()=>{
 for(const mutate of [o=>o.ocrConfidence=40,o=>o.raw='Quantity: 1,234',o=>o.raw='Quantity: ??',o=>o.source.box.x1=2]){
  const f=mobileFixture({ambiguous:false});mutate(f.source.observations.find(o=>o.raw.startsWith('Quantity')));
  const result=resolveMobileCards(f.source);assert.ok(result.rows.length<3);assert.ok(result.unresolved.length>0);
 }
 const f=mobileFixture({ambiguous:false});f.source.issues.push({level:'blocking',code:'BAD'});assert.equal(resolveMobileCards(f.source).rows.length,0);
});
test('missing listing, malformed ISIN and duplicate quantity cannot be learned away',()=>{
 for(const raw of ['Ticker: QJPA','ISIN: US0000000000','Quantity: 99']){
  const f=mobileFixture({ambiguous:false});f.source.observations.find(o=>o.raw.startsWith('Ticker')).raw=raw;
  assert.equal(resolveMobileCards(f.source).rows.length,2);
 }
});
test('changed layout stays unresolved; conflicting explicit corrections block',async()=>{
 const l=createStructureLearner();await teach(l,mobileFixture());await teach(l,mobileFixture({round:1}));
 const changed=mobileFixture({round:2});changed.source.observations.find(o=>o.raw==='Research basket').raw='Current value: 50 USD';
 const result=resolveMobileCards(changed.source,l);assert.equal(result.rows.filter(r=>r.learned).length,2);
 await teach(l,mobileFixture({round:3}),0);assert.equal(resolveMobileCards(mobileFixture().source,l).rows.length,0);
});
test('replay fingerprint ignores replacement source IDs but differs for a new dataset',async()=>{
 const f=mobileFixture(),key=await documentKey(f.source);f.source.observations.forEach(o=>o.id='new'+o.id);
 assert.equal(await documentKey(f.source),key);assert.notEqual(await documentKey(mobileFixture({round:1}).source),key);
});
test('duplicates do not merge or add; source accounts remain separate',()=>{
 const f=mobileFixture({ambiguous:false});const identities=f.source.observations.filter(o=>o.raw.startsWith('Ticker'));
 identities[1].raw=identities[0].raw;let result=resolveMobileCards(f.source);assert.equal(result.rows.length,1);assert.equal(result.unresolved.filter(u=>u.reason==='DUPLICATE_HOLDING').length,2);
 const a=mobileFixture({ambiguous:false,account:'A'}),b=mobileFixture({ambiguous:false,account:'B'});
 b.source.observations.forEach(o=>{o.id='b'+o.id;o.source.page=2;});
 result=resolveMobileCards({...a.source,observations:[...a.source.observations,...b.source.observations]});
 assert.equal(result.rows.length,6);assert.equal(new Set(result.rows.map(r=>r.fields.account.value)).size,2);
});
test('unknown international names and source ISINs remain generic; no currency is guessed',()=>{
 const f=mobileFixture({ambiguous:false});const names=['Ångström Teknik','新しい研究','Meridian Fund'];
 let index=0;
 f.source.observations.forEach(o=>{if(f.oracle.some(x=>x.name===o.raw))o.raw=names[index++];if(o.raw==='Currency: USD')o.raw='Show sources';});
 const result=resolveMobileCards(f.source);assert.deepEqual(result.rows.map(r=>r.fields.name.value),names);assert.ok(result.rows.every(r=>r.fields.currency.value===null));
});
test('Swedish quantities and separate listing identifiers do not merge instruments',()=>{
 const f=mobileFixture({ambiguous:false});f.source.observations.forEach(o=>{o.raw=o.raw.replace('Quantity:','Antal:').replace('Current price:','Marknadspris:').replace('Day change:','Förändring:');});
 const identities=f.source.observations.filter(o=>o.raw.startsWith('Ticker'));
 identities[1].raw=identities[0].raw.replace('XNAS','XSTO');
 const result=resolveMobileCards(f.source);assert.equal(result.rows.length,3);
 assert.deepEqual(result.rows.slice(0,2).map(r=>r.fields.identity.value.mic),['XNAS','XSTO']);
});
test('source IDs, confidence, pages and column geometry cannot silently disappear',()=>{
 for(const mutate of [f=>f.source.observations[1].id=f.source.observations[0].id,
  f=>f.source.observations.find(o=>o.raw.startsWith('Quantity')).ocrConfidence=null,
  f=>f.source.observations.find(o=>o.raw.startsWith('Quantity')).source.page=0]){
  const f=mobileFixture({ambiguous:false});mutate(f);assert.ok(resolveMobileCards(f.source).rows.length<3);
 }
 // A large gap on a shared baseline denotes unsupported horizontal columns.
 const f=mobileFixture({ambiguous:false});const q=f.source.observations.find(o=>o.raw.startsWith('Quantity'));
 f.source.observations.push({...q,id:'side-column',raw:'Other card',source:{...q.source,box:{...q.source.box,x0:.8,x1:.99}}});
 assert.equal(resolveMobileCards(f.source).rows.length,2);
});
test('source account cannot leak from one page to the next',()=>{
 const a=mobileFixture({ambiguous:false}),b=mobileFixture({ambiguous:false});
 b.source.observations=b.source.observations.filter(o=>!o.raw.startsWith('Account:'));
 b.source.observations.forEach(o=>{o.id='second'+o.id;o.source.page=2;});
 const result=resolveMobileCards({...a.source,observations:[...a.source.observations,...b.source.observations]});
 assert.equal(result.rows.length,6);assert.ok(result.rows.slice(3).every(r=>r.fields.account.value===null));
});
test('actual ISIN checksum is checked without a company table',()=>{
 // Fictional identifier with a valid Luhn checksum, not a market-validity assertion.
 const base='ZZ123456789';let isin;
 for(let n=0;n<10;n++){
  const f=mobileFixture({ambiguous:false});f.source.observations.find(o=>o.raw.startsWith('Ticker')).raw=`ISIN: ${base}${n}`;
  const rows=resolveMobileCards(f.source).rows;if(rows.length===3){assert.equal(isin,undefined);isin=rows[0].fields.identity.value.isin;}
 }
 assert.ok(isin?.startsWith('ZZ'));assert.equal(isin.length,12);
});
test('disagreement between OCR readings blocks identities rather than fixing characters',async()=>{
 const {corroborateOcrIdentities}=await import('../src/mobile-card-holdings.mjs');
 const a=mobileFixture({ambiguous:false}).source,b=structuredClone(a);
 b.observations.find(o=>o.raw.startsWith('Ticker')).raw='Ticker: OJPA MIC: XNAS';
 const result=resolveMobileCards(corroborateOcrIdentities(a,b));
 assert.equal(result.rows.length,2);assert.ok(result.unresolved.some(u=>u.reason==='OCR_IDENTITY_DISAGREEMENT'));
 assert.equal(a.observations.some(o=>o.identityDisagreement),false);
 assert.equal(resolveMobileCards(corroborateOcrIdentities(a,a)).rows.length,3);
 assert.equal(resolveMobileCards(corroborateOcrIdentities(a,{...a,observations:[]})).rows.length,0);
});
test('learned positions transfer to entirely unseen names and listing codes',async()=>{
 const l=createStructureLearner();await teach(l,mobileFixture());await teach(l,mobileFixture({round:1}));
 const f=mobileFixture({round:2});
 const identities=f.source.observations.filter(o=>o.raw.startsWith('Ticker'));
 for(let i=0;i<3;i++){f.source.observations.find(o=>o.raw===f.oracle[i].name).raw=['Birch Networks','Sierra Analytics','Windward Index Fund'][i];identities[i].raw=`Ticker: ZYX${i} MIC: XLON`;}
 const rows=resolveMobileCards(f.source,l).rows;
 assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.fields.identity.value.ticker),['ZYX0','ZYX1','ZYX2']);
 assert.deepEqual(rows.map(r=>r.fields.name.value),['Birch Networks','Sierra Analytics','Windward Index Fund']);
});
test('two cards without a provable gap are not joined into a synthetic holding',()=>{
 const f=mobileFixture({ambiguous:false});const obs=f.source.observations.filter(o=>!['More','Show sources'].includes(o.raw)&&!o.raw.startsWith('Account:')&&!o.raw.startsWith('Balance:'));
 obs.forEach((o,i)=>{o.source.box.y0=.01+i*.025;o.source.box.y1=o.source.box.y0+.02;});
 const result=resolveMobileCards({...f.source,observations:obs});assert.equal(result.rows.length,0);assert.ok(result.unresolved.length>0);
});
test('unknown intervening section invalidates account inheritance',()=>{
 const f=mobileFixture({ambiguous:false});
 // Repurpose a separated control between the explicit account and holdings.
 const control=f.source.observations.find(o=>o.raw==='More');control.raw='Unrecognised account header';
 control.source.box.y0=.06;control.source.box.y1=.075;
 const account=f.source.observations.find(o=>o.raw.startsWith('Account:'));
 account.source.box.y0=.005;account.source.box.y1=.02;
 const result=resolveMobileCards(f.source);
 assert.ok(result.rows.length>0);assert.ok(result.rows.every(r=>r.fields.account.value===null));
});
