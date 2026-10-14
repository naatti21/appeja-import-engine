import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePositionedHoldings} from '../src/positioned-holdings.mjs';
const names=['Row','Account','Name','Currency','Quantity','Current price','Market value','Purchase price'];
const values=[
 ['R1','SYN-1','Synthetic Asset 1','EUR','3,00','12,50','37,50','10,00'],
 ['R2','SYN-2','Synthetic Asset 2','USD','2,00','5,25','10,50','9,00']
];
function mock({matrix=[names,...values],page=1,ocr=false,shift=0,cut=null,issues=[]}={}){
 const obs=[];
 matrix.forEach((line,r)=>line.forEach((text,c)=>{
  if(cut?.row===r&&cut?.col===c)return;
  const x=(20+c*250)/2300+shift,y=(66+r*55)/360;
  obs.push({id:'obs-'+r+'-'+c,raw:String(text),source:{
    format:ocr?'image-ocr':'pdf',page,
    box:{x0:x,y0:y,x1:x+.06,y1:y+.04}},status:'observed'});
 }));
 return {sourceKind:ocr?'image-ocr-tsv':'pdf',observations:obs,issues};
}
const codes=r=>r.problems.map(x=>x.code);
test('two position rows with independent known values and source IDs',()=>{
 const e=mock(),parsed=resolvePositionedHoldings(e);
 assert.equal(parsed.rows.length,2);
 assert.equal(parsed.trace.candidateRows,2);
 assert.equal(parsed.rows[0].fields.quantity.value,3);
 assert.equal(parsed.rows[0].fields.current_value.value,37.5);
 assert.equal(parsed.rows[1].fields.account.value,'SYN-2');
 assert.equal(parsed.rows[0].fields.purchase_price.sourceIds[0],'obs-1-7');
 assert.equal(parsed.canPersist,false);
 assert.equal(parsed.status,'review-required');
 assert.deepEqual(codes(parsed),[]);
});
test('vary physical columns: rearrange both oracle header and records',()=>{
 const order=[4,6,2,0,7,5,1,3];
 const e=mock({matrix:[names,...values].map(row=>order.map(i=>row[i]))});
 const p=resolvePositionedHoldings(e);
 assert.equal(p.rows.length,2);
 assert.equal(p.rows[0].fields.account.value,'SYN-1');
 assert.equal(p.rows[0].fields.current_value.value,37.5);
});
test('one missing cost is NEVER inferred from the current value',()=>{
 const e=mock({cut:{row:1,col:7}});
 const p=resolvePositionedHoldings(e);
 assert.equal(p.rows[0].fields.purchase_price.status,'missing');
 assert.equal(p.rows[0].fields.purchase_price.value,null);
 assert.ok(codes(p).includes('ROW_FIELD_NOT_CONFIRMED'));
});
test('OCR comma-loss is detected through independent quantity-price-value consistency',()=>{
 const e=mock({ocr:true});
 e.observations.find(o=>o.id==='obs-1-5').raw='1250';
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('VALUE_PRICE_QUANTITY_CONFLICT'));
 assert.equal(r.canPersist,false);
});
test('two duplicate current-price headers block the table',()=>{
 const e=mock();
 e.observations.find(o=>o.id==='obs-0-7').raw='Current price';
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('DUPLICATE_SEMANTIC_HEADER'));
 assert.ok(codes(r).includes('NO_VERIFIABLE_TABLE_HEADER'));
 assert.equal(r.rows.length,0);
});
test('unmapped monetary header cannot be silently discarded',()=>{
 const matrix=[names.concat('Unknown money'),...values.map(r=>r.concat('999,99'))];
 const r=resolvePositionedHoldings(mock({matrix}));
 assert.ok(codes(r).includes('UNKNOWN_OR_UNMAPPED_HEADER'));
 assert.equal(r.rows.length,0);
});
test('two accounts with same name remain two separate positions',()=>{
 const matrix=[names,...values];
 const e=mock({matrix});
 e.observations.find(o=>o.id==='obs-2-2').raw='Synthetic Asset 1';
 const r=resolvePositionedHoldings(e);
 assert.equal(r.rows.length,2);
 assert.ok(!codes(r).includes('REPEATED_HOLDING_NEEDS_REVIEW'));
});
test('same account same instrument is surfaced as potential duplicate',()=>{
 const e=mock();
 e.observations.find(o=>o.id==='obs-2-1').raw='SYN-1';
 e.observations.find(o=>o.id==='obs-2-2').raw='Synthetic Asset 1';
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('REPEATED_HOLDING_NEEDS_REVIEW'));
 assert.equal(r.rows.length,2);
});
test('negative and zero quantity require manual resolution',()=>{
 const e=mock();
 e.observations.find(o=>o.id==='obs-1-4').raw='0';
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('NONPOSITIVE_QUANTITY'));
});
test('no source geometry cannot be used to fabricate values',()=>{
 const e=mock();
 delete e.observations[0].source.box;
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('UNUSABLE_SOURCE_GEOMETRY'));
 assert.equal(r.rows.length,0);
});
test('geometry shifted off a column cannot be silently accounted',()=>{
 const e=mock();
 e.observations.find(o=>o.id==='obs-1-5').source.box.x0+=.084;
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('UNUSABLE_SOURCE_GEOMETRY'));
 assert.equal(r.rows.length,0);
});
test('source kind other than actual PDF/OCR cannot masquerade as positioning',()=>{
 const e=mock();e.sourceKind='csv';
 const r=resolvePositionedHoldings(e);
 assert.ok(codes(r).includes('UNSUPPORTED_POSITIONAL_SOURCE'));
});
test('source issues are not ignored on otherwise clean rows',()=>{
 const r=resolvePositionedHoldings(mock({issues:[{code:'INVALID_OCR_CONFIDENCE'}]}));
 assert.ok(codes(r).includes('INVALID_OCR_CONFIDENCE'));
 assert.equal(r.canPersist,false);
});
test('Finnish and Swedish headers resolve to the same canonical fields',()=>{
 const rows=[values[0]];
 for(const h of [
  ['Rivi','Tili','Nimi','Valuutta','Määrä','Nykykurssi','Nykyarvo','Hankintahinta'],
  ['Rad','Konto','Namn','Valuta','Antal','Aktuell kurs','Marknadsvärde','Inköpspris']
 ]){
  const r=resolvePositionedHoldings(mock({matrix:[h,...rows]}));
  assert.equal(r.rows.length,1);
  assert.equal(r.rows[0].fields.quantity.value,3);
 }
});
