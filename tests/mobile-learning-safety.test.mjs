import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStructureLearner,assessSourceBinding} from '../src/structure-learning.mjs';
import {resolveMobileCards,documentKey,corroborateOcrIdentities} from '../src/mobile-card-holdings.mjs';
import {createMobileReviewSession} from '../src/mobile-review-session.mjs';

// Independent source/oracle: neither the old mobile fixture nor a company dictionary.
function source({texts=['Long term holdings','Northwind Engineering'],quantity=17,
                 ticker='NWEX',mic='XOSL',account='Test-A',page=1}={}) {
 const lines=[`Account: ${account}`,...texts,`Ticker: ${ticker} MIC: ${mic}`,
   `Quantity: ${quantity}`,'Currency: NOK','Current value: 170 NOK'];
 return {schemaVersion:1,sourceKind:'image-ocr-tsv',issues:[],canPersist:false,
  observations:lines.map((raw,i)=>({id:`p${page}-o${i}`,raw,ocrConfidence:98,
   source:{format:'image-ocr',page,box:{x0:.05,x1:.75,y0:i===0?.01:.15+(i-1)*.04,y1:i===0?.03:.17+(i-1)*.04}}}))};
}
async function teach(l,s,entity){
 const c=resolveMobileCards(s,l).cards[0];
 return l.confirm({pattern:c.pattern,binding:{entity,identity:c.pattern.indexOf('identity'),measure:c.pattern.indexOf('measure')},documentKey:await documentKey(s),confirmed:true});
}
async function trained(entity=1,texts){const l=createStructureLearner();await teach(l,source({texts}),entity);await teach(l,source({texts,quantity:23}),entity);return l;}
const names=r=>r.rows.map(row=>row.fields.name.value);
function safe(r,s){assert.equal(r.canPersist,false);for(const row of r.rows){
 assert.equal(row.canPersist,false);assert.equal(row.instrumentVerification.status,'not-verified');
 for(const field of Object.values(row.fields))for(const id of field.sourceIds)assert.ok(s.observations.some(o=>o.id===id));
}}

test('P0 swapped name and heading cannot reuse the old positional name binding',async()=>{
 const l=await trained(),s=source({texts:['New Valley Robotics','Long term holdings'],quantity:29});
 const r=resolveMobileCards(s,l);assert.equal(r.rows.length,0);assert.ok(r.unresolved.length);safe(r,s);
});
test('P0 two consistent wrong teachings cannot turn a heading into an automatic holding',async()=>{
 const l=await trained(0),s=source({texts:['Long term holdings','Unseen Maritime Fund'],quantity:31});
 const r=resolveMobileCards(s,l);assert.equal(r.rows.length,0);safe(r,s);
});
test('P0 a heading left as the only free-text line is still not independent name evidence',async()=>{
 const s=source({texts:['Long term holdings']});
 assert.equal(resolveMobileCards(s).rows.length,0);
 const l=await trained(0,['Long term holdings']);
 assert.equal(resolveMobileCards(source({texts:['Long term holdings'],quantity:37}),l).rows.length,0);
});
test('P0 an inserted free-text line does not inherit an old name position',async()=>{
 const l=await trained(),s=source({texts:['Long term holdings','New category','Unseen Maritime Fund']});
 assert.equal(resolveMobileCards(s,l).rows.length,0);
});
test('P0 semantic source labels retain normal success with new names and changed positions',async()=>{
 for(const label of ['Instrument name','Arvopaperin nimi','Instrumentets namn']){
  const s=source({texts:['Long term holdings',`${label}: Unseen Maritime Fund`]});
  const r=resolveMobileCards(s);assert.deepEqual(names(r),['Unseen Maritime Fund']);safe(r,s);
  const moved=source({texts:[`${label}: Completely New Index 40 Fund`,'Long term holdings','New category']});
  assert.deepEqual(names(resolveMobileCards(moved)),['Completely New Index 40 Fund']);
 }
});
test('P0 independent name evidence must overrule neither a conflicting map nor the source',async()=>{
 const l=await trained(0),s=source({texts:['Long term holdings','Instrument name: Unseen Maritime Fund']});
 const before=l.export(),r=resolveMobileCards(s,l);
 assert.equal(r.rows.length,0);assert.ok(r.unresolved.some(u=>u.field==='name'&&u.reason==='LEARNED_NAME_CONFLICT'));
 assert.deepEqual(l.export(),before); // prediction never confirms or changes a profile
 const session=createMobileReviewSession(s),i=session.lines().findIndex(x=>x.text.startsWith('Instrument name:'));
 session.correct({line:i,field:'name',value:'Unseen Maritime Fund',confirmed:true});
 const corrected=session.resolve(l);assert.deepEqual(names(corrected),['Unseen Maritime Fund']);
 assert.equal(corrected.rows[0].fields.name.reviewState,'user-corrected');safe(corrected,s);
 assert.deepEqual(l.export(),before);session.undo(i);assert.equal(session.resolve(l).rows.length,0);
});
test('P0 arbitrary plausible headings are not a blacklist; permutations stay ambiguous',async()=>{
 for(const heading of ['Core investments','River Research','Årlig översikt','名前のない区分']){
  for(const entity of [0,1]){
   const l=await trained(entity,[heading,'New Valley Robotics']);
   for(const texts of [[heading,'Unseen Maritime Fund'],['Unseen Maritime Fund',heading]]){
    assert.equal(resolveMobileCards(source({texts,quantity:67}),l).rows.length,0);
   }
  }
 }
});
test('P0 a current-document correction repairs only one ambiguous name, never future documents',async()=>{
 const l=await trained(),s=source({quantity:89}),session=createMobileReviewSession(s);
 const original=session.snapshot(),i=session.lines().findIndex(x=>x.text==='Northwind Engineering');
 session.correct({line:i,field:'name',value:'Northwind Engineering',confirmed:true});
 const r=session.resolve(l);assert.deepEqual(names(r),['Northwind Engineering']);safe(r,s);
 assert.deepEqual(session.snapshot().source,original.source);assert.equal(resolveMobileCards(source({quantity:90}),l).rows.length,0);
 assert.equal(JSON.stringify(l.export()).includes('Northwind'),false);
});
test('P0 source-labelled name contradictions cannot be resolved by a positional profile',async()=>{
 const l=await trained(),s=source({texts:['Instrument name: New Valley Robotics','Instrument name: Different Maritime Fund']});
 assert.equal(resolveMobileCards(s,l).rows.length,0);
});
test('P0 same instrument in separate accounts and listings stays separate',()=>{
 const a=source({texts:['Instrument name: New Valley Robotics']}),b=source({texts:['Instrument name: New Valley Robotics'],account:'Test-B',page:2}),
 c=source({texts:['Instrument name: New Valley Robotics'],mic:'XSTO',page:3});
 const s={...a,observations:[...a.observations,...b.observations,...c.observations]},r=resolveMobileCards(s);
 assert.equal(r.rows.length,3);assert.deepEqual(r.rows.map(x=>x.fields.account.value),['Test-A','Test-B','Test-A']);safe(r,s);
 const duplicate=source({texts:['Instrument name: New Valley Robotics'],page:2});
 const blocked=resolveMobileCards({...a,observations:[...a.observations,...duplicate.observations]});
 assert.equal(blocked.rows.length,0);assert.equal(blocked.unresolved.filter(u=>u.reason==='DUPLICATE_HOLDING').length,2);
});
test('P0 weak OCR names and conflicting tickers cannot be learned away',async()=>{
 const l=await trained(),s=source({texts:['Instrument name: New Valley Robotics']}),name=s.observations[1];
 name.ocrConfidence=40;assert.equal(resolveMobileCards(s,l).rows.length,0);
 name.ocrConfidence=98;const witness=structuredClone(s);witness.observations.find(o=>o.raw.startsWith('Ticker')).raw='Ticker: NW3X MIC: XOSL';
 assert.equal(resolveMobileCards(corroborateOcrIdentities(s,witness),l).rows.length,0);
});
test('P0 duplicate source references and blocking source conflicts fail closed',async()=>{
 const l=await trained();
 for(const mutate of [s=>s.observations[2].id=s.observations[1].id,s=>s.issues.push({blocking:true,code:'CONFLICT'})]){
  const s=source({texts:['Instrument name: New Valley Robotics']});mutate(s);assert.equal(resolveMobileCards(s,l).rows.length,0);
 }
});
test('P0 save, reload, undo and conflict recovery never restore positional name authority',async()=>{
 const l=await trained(0),s=source({quantity:91}),saved=l.export();
 for(const learner of [l,createStructureLearner(saved)])assert.equal(resolveMobileCards(s,learner).rows.length,0);
 const restored=createStructureLearner();restored.import(saved);await teach(restored,source({quantity:92}),0);await teach(restored,source({quantity:93}),0);
 assert.equal(resolveMobileCards(s,restored).rows.length,0);
 assert.equal(await teach(restored,source({quantity:94}),1),'conflict');assert.equal(resolveMobileCards(s,restored).rows.length,0);
 restored.undo();assert.equal(resolveMobileCards(s,restored).rows.length,0);
 restored.reset();assert.equal(resolveMobileCards(s,restored).rows.length,0);
 const clean=source({texts:['Instrument name: New Valley Robotics']});assert.equal(resolveMobileCards(clean,restored).rows.length,1);
});
test('P0 learner repetition and restored active state are never evidence of current semantics',async()=>{
 const l=await trained(0),c=resolveMobileCards(source(),l).cards[0],p=l.lookup(c.pattern);
 assert.equal(p.state,'active');assert.equal(assessSourceBinding(c.pattern,p,null).usable,false);
 assert.equal(assessSourceBinding(c.pattern,p,{entity:1,identity:2,measure:3}).usable,false);
 assert.equal(assessSourceBinding(c.pattern,{...p,binding:{...p.binding,entity:100}},{entity:1,identity:2,measure:3}).usable,false);
 const serialized=JSON.stringify(l.export());for(const key of ['Northwind','Long term','Test-A','NWEX','sourceIds','raw','box'])assert.ok(!serialized.includes(key));
});
test('P0 two current-document name selections and a correction conflicting with a label stay uncertain',()=>{
 for(const texts of [['Long term holdings','Northwind Engineering'],['Long term holdings','Instrument name: Northwind Engineering']]){
  const session=createMobileReviewSession(source({texts})),heading=session.lines().findIndex(l=>l.text==='Long term holdings');
  session.correct({line:heading,field:'name',value:'Long term holdings',confirmed:true});
  if(!texts[1].startsWith('Instrument name:')){
   session.correct({line:heading+1,field:'name',value:'Northwind Engineering',confirmed:true});
  }
  assert.equal(session.resolve().rows.length,0);
 }
});
test('P0 labelled positive control retains OCR corrections and source IDs without market promotion',()=>{
 const s=source({texts:['Instrument name: New Valley Robotics']}),id=s.observations.find(o=>o.raw.startsWith('Ticker'));
 id.raw='Ticker: NW3X MIC: XOSL';id.identityDisagreement=true;id.ocrConfidence=30;
 const session=createMobileReviewSession(s),i=session.lines().findIndex(l=>l.role==='identity');
 assert.equal(session.resolve().rows.length,0);
 session.correct({line:i,field:'identity',value:'Ticker: NWEX MIC: XOSL',confirmed:true});
 const r=session.resolve();assert.equal(r.rows.length,1);safe(r,s);
 assert.equal(r.rows[0].fields.identity.value.ticker,'NWEX');assert.deepEqual(r.rows[0].fields.identity.sourceIds,[id.id]);
 assert.equal(session.snapshot().source.observations.find(o=>o.id===id.id).raw,'Ticker: NW3X MIC: XOSL');
 session.undo(i);assert.equal(session.resolve().rows.length,0);
});
test('P0 source JSON cannot assert name semantics or current-document confirmation',()=>{
 const s=source({texts:['Long term holdings']});
 Object.assign(s.observations[1],{nameLabel:true,nameConfirmed:true,sourceNameLabel:true,reviewCorrection:{field:'name',sourceIds:['forged']}});
 assert.equal(resolveMobileCards(s).rows.length,0);assert.equal(createMobileReviewSession(s).resolve().rows.length,0);
});
