import test from 'node:test';import assert from 'node:assert/strict';
import {csvModel,payrollModel,review,exampleModel,normalizeOcrTsv,sourceLabel} from '../research/browser-review-v1/model.mjs';
test('Y12 CSV keeps original cell/source-line after blank rows and never authorizes persistence',()=>{
 const m=csvModel('Name;Quantity;Buy Price;Currency;Account\n\nSYN-A;8;12,50;EUR;SYN-1');
 const o=m.original.layout.observations.find(o=>o.raw==='8');assert.equal(o.sourceLine,3);assert.equal(sourceLabel(o),'CSV lähderivi 3, solu R2C2');
 assert.equal(review(m).result.canPersist,false);assert.equal(review(m).result.canAutoAccept,false);assert.ok(Object.isFrozen(m.original.layout.observations));
});
test('Y12 role correction is a separate reversible draft; source bytes never change',()=>{
 const m=exampleModel('heading'),original=JSON.stringify(m.original);
 m.edits.payDate={value:'2027-03-19',valueIds:['date'],headerIds:['head'],contextIds:[],currency:''};
 const r=review(m);assert.ok(!r.result.audit.newWarnings.some(w=>w.sourceId==='head'));assert.equal(r.result.canAutoAccept,false);
 assert.equal(JSON.stringify(m.original),original);delete m.edits.payDate;
 assert.ok(review(m).result.audit.newWarnings.some(w=>w.sourceId==='head'));
});
test('Y12 changed amount is not a new source and remains blocked',()=>{
 const m=csvModel('Name;Quantity;Buy Price;Currency\nSYN-A;8;12,50;EUR');
 m.edits['row1:quantity']={value:'800',valueIds:['csv-r2-c2'],headerIds:[],contextIds:[],currency:''};
 const r=review(m);assert.ok(r.result.audit.newWarnings.some(w=>w.sourceId==='csv-r2-c2'));assert.equal(m.original.fields['row1:quantity'].value,8);
});
test('Y12 unsupported global/column bindings and nuisance metadata stay visible',()=>{
 for(const f of ['global','column','metadata'])assert.ok(review(exampleModel(f)).result.audit.newWarnings.length>0);
});
test('Y12 headerless genuine v5 TSV has strict schema; malformed text is not guessed',()=>{
 const s='1\t1\t0\t0\t0\t0\t0\t0\t100\t100\t-1\t\n';
 assert.ok(normalizeOcrTsv(s).startsWith('level\t'));
 assert.throws(()=>normalizeOcrTsv('some text'));
});
test('Y12 malformed CSV and invalid draft values report failure',()=>{
 assert.throws(()=>csvModel('one column only'));
 const m=csvModel('Name;Quantity;Buy Price;Currency\nSYN-A;8;12,50;EUR');
 m.edits['row1:quantity']={value:'abc',valueIds:['csv-r2-c2'],headerIds:[],contextIds:[],currency:''};assert.throws(()=>review(m));
});

test('Y12 section/table disagreement preserves both source sets and blocks the proposal',()=>{
 const specs=[['explicit','Veronalainen ansio / kausi 3500,00',.1,.1,.65],['h1','Kertymä palkkakaudelta',.2,.3,.2],['h2','Kertymä vuoden alusta',.6,.3,.2],['label','Ver.al.ans',.05,.36,.1],['g','3 200,00',.21,.36,.1],['y','42 000,00',.61,.36,.1]];
 const observations=specs.map(([id,raw,x,y,w])=>({id,raw,page:1,box:{x0:x,y0:y,x1:x+w,y1:y+.02},kind:'text'}));
 const rows=[['explicit'],['h1','h2'],['label','g','y']].map((tokenIds,i)=>({id:'r'+i,page:1,y:[.11,.31,.37][i],tokenIds}));
 const m=payrollModel({observations,pages:[{page:1,rows}],issues:[],unplacedObservations:[]});
 assert.equal(m.original.fields.grossPay.status,'conflict');assert.equal(m.original.fields.grossPay.value,null);
 assert.deepEqual(m.original.fields.grossPay.sourceIds,['explicit','g']);assert.equal(review(m).result.canAutoAccept,false);
});
