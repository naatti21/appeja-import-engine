import test from 'node:test';import assert from 'node:assert/strict';
import {csvModel,review,exampleModel,normalizeOcrTsv,sourceLabel} from '../research/browser-review-v1/model.mjs';
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
