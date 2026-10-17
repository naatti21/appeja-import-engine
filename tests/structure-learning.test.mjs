import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStructureLearner,sanitizeStructureStore} from '../src/structure-learning.mjs';
const pattern=['text','text','identity','measure','currency'];
const binding={entity:1,identity:2,measure:3};
const teach=(l,key='a',b=binding)=>l.confirm({pattern,binding:b,documentKey:key,confirmed:true});
test('two explicit distinct documents, never prediction or repeated imports, activate a layout',()=>{
 const l=createStructureLearner(); assert.equal(teach(l),'provisional');
 for(let i=0;i<5;i++){l.lookup(pattern);assert.equal(teach(l),'provisional');}
 assert.equal(teach(l,'b'),'active');
});
test('different binding quarantines active profile; undo preserves previous state',()=>{
 const l=createStructureLearner();teach(l);teach(l,'b');
 assert.equal(teach(l,'c',{...binding,entity:0}),'conflict');
 assert.throws(()=>teach(l,'d'),/CONFLICT/);assert.equal(l.undo(),true);assert.equal(l.lookup(pattern).state,'active');
});
test('backup allowlist excludes raw data, hashes, boxes and injected fields; import requires revalidation',()=>{
 const l=createStructureLearner();teach(l,'private document hash');teach(l,'private hash 2');
 const raw=l.export();raw.ocr='Private account';raw.profiles[0].values=['secret'];raw.profiles[0].box={x:1};
 const clean=sanitizeStructureStore(raw);const json=JSON.stringify(clean);
 for(const s of ['private','secret','account','box','hash','values'])assert.ok(!json.includes(s));
 const other=createStructureLearner();other.import(raw);assert.equal(other.lookup(pattern).state,'provisional');
 assert.equal(teach(other),'provisional');assert.equal(teach(other,'b'),'active');
});
test('reload cannot combine provisional previous-session proof with a repeated document',()=>{
 const a=createStructureLearner();teach(a);
 const b=createStructureLearner(a.export());assert.equal(teach(b),'provisional');assert.equal(teach(b,'b'),'active');
});
test('closed schema, positions, field roles, version and explicit confirmation are required',()=>{
 const l=createStructureLearner();
 for(const bad of [{...binding,measure:0},{...binding,entity:44},{...binding,secret:1}])assert.throws(()=>teach(l,'x',bad));
 assert.throws(()=>l.confirm({pattern,binding,documentKey:'a',confirmed:false}));
 assert.throws(()=>l.confirm({pattern:['secret',...pattern],binding,documentKey:'a',confirmed:true}));
 assert.throws(()=>createStructureLearner({app:'Palkka PWA',version:1,profiles:[]}));
 assert.throws(()=>createStructureLearner({...l.export(),version:2}));
 assert.throws(()=>createStructureLearner({...l.export(),profiles:Array(17).fill({})}));
});
test('reset and undo affect structures only, exports are detached',()=>{
 const l=createStructureLearner();teach(l);const copy=l.export();copy.profiles[0].state='active';
 assert.equal(l.lookup(pattern).state,'provisional');l.reset();assert.equal(l.lookup(pattern),null);
 l.undo();assert.equal(l.lookup(pattern).state,'provisional');
});
test('profile capacity is enforced at confirmation, not only restore',()=>{
 const l=createStructureLearner();
 for(let n=0;n<16;n++)l.confirm({pattern:[...pattern,...Array.from({length:4},(_,i)=>n&(1<<i)?'price':'total')],binding,documentKey:'dataset',confirmed:true});
 assert.equal(l.export().profiles.length,16);
 assert.throws(()=>teach(l),/PROFILE_LIMIT/);
});
