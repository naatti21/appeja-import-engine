import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {layoutFromPdfItems} from '../src/layout.mjs';
import {parsePayrollSections} from '../src/payroll-sections.mjs';

function asLayout(text){
 const lines=text.split('\n');
 return layoutFromPdfItems([{width:2400,height:1200,items:lines.map((str,i)=>({
  str,transform:[12,0,0,12,50,1160-i*23],width:Math.max(20,str.length*10),height:12
 }))}]);
}
async function source(name){return readFile(new URL('./fixtures/complete-payslips/'+name+'.txt',import.meta.url),'utf8');}
const expected=[['a-modern',11],['b-compact',12],['c-alt-terms',9]];
for(const [name,count] of expected){
 test('known payline rows are fully sourced: '+name,async()=>{
  const result=parsePayrollSections(asLayout(await source(name)));
  assert.equal(result.payLines.length,count,name);
  if(result.unmatchedPayLines.length)console.log('PAYLINE_UNMATCHED_DIAGNOSTIC '+name+' '+JSON.stringify(result.unmatchedPayLines));
  assert.equal(result.unmatchedPayLines.length,0);
  assert.ok(result.coverage.unresolvedObservations>0,'remaining ancillary money is not silently dismissed');
  assert.equal(result.decision.status,'review-required');
  const knownIds=new Set(result.observations.map(x=>x.id));
  for(const row of result.payLines){
   assert.ok(row.sourceIds.length>0,row.code);
   for(const id of row.sourceIds)assert.ok(knownIds.has(id),row.code+' bad id');
   assert.equal(Number.isFinite(row.amount),true,row.code);
  }
  const before=new Set(Object.values(result.fields).flatMap(f=>f.status==='verified'?f.sourceIds:[]));
  const oldCoverage=result.observations.filter(o=>o.material&&before.has(o.id)).length;
  assert.ok(result.coverage.coveredObservations>oldCoverage,'ledger must add real coverage');
  assert.ok(result.coverage.coveredObservations<=result.coverage.materialObservations);
  assert.equal(result.canPersist,false);
 });
}
test('tax-card accumulation is NOT YTD, and withholding line is reconciled',async()=>{
 const result=parsePayrollSections(asLayout(await source('a-modern')));
 const withholding=result.payLines.find(r=>r.code==='90000');
 assert.equal(withholding.taxCardAccumulatedIncome,8028.58);
 assert.equal(withholding.amount,-1526.89);
 assert.equal(result.fields.ytdTaxableIncome.value,63832.82);
 assert.equal(result.fields.withholdingPeriod.value,1526.89);
 assert.ok(!result.issues.some(i=>i.code==='WITHHOLDING_PERIOD_MISMATCH'));
});
test('half-rate overtime is checked using the source multiplier',async()=>{
 const r=parsePayrollSections(asLayout(await source('b-compact')));
 assert.equal(r.payLines.find(x=>x.code==='20050').factor,0.5);
 assert.equal(r.payLines.find(x=>x.code==='20070').factor,0.5);
 assert.ok(!r.issues.some(x=>x.code==='PAYLINE_ARITHMETIC_MISMATCH'));
});
test('tampered amount is blocked and never accounted for',async()=>{
 const altered=(await source('a-modern')).replace('7,90 25,07 99,03','7,90 25,07 299,03');
 const r=parsePayrollSections(asLayout(altered));
 assert.ok(r.issues.some(x=>x.code==='PAYLINE_ARITHMETIC_MISMATCH'));
 assert.ok(r.unmatchedPayLines.some(x=>x.raw.includes('299,03')));
 assert.ok(r.decision.problems.some(x=>x.code==='UNACCOUNTED_MATERIAL'));
});
test('unknown salary code stays in evidence and blocks',async()=>{
 const altered=(await source('c-alt-terms'))+'\n29999 Uusi palkkalaji 2,00 10,00 20,00';
 const r=parsePayrollSections(asLayout(altered));
 assert.ok(r.issues.some(x=>x.code==='UNKNOWN_PAYLINE_CODE'));
 assert.equal(r.decision.canAutoAccept,false);
 assert.ok(r.unmatchedPayLines.some(x=>x.raw.includes('Uusi palkkalaji')));
});
test('mismatched code and label cannot launder a known value',async()=>{
 const altered=(await source('c-alt-terms')).replace('20040 Ylityö 100 % vrk','20040 Sunnuntaityö');
 const r=parsePayrollSections(asLayout(altered));
 assert.ok(r.issues.some(x=>x.code==='PAYLINE_LABEL_MISMATCH'));
});
test('deduction contradicting a period summary triggers blocking cross-check',async()=>{
 const altered=(await source('a-modern')).replace(
  '90000 Ennakonpidätys 8 028,58 -1 526,89',
  '90000 Ennakonpidätys 8 028,58 -1 525,89');
 const r=parsePayrollSections(asLayout(altered));
 assert.ok(r.issues.some(x=>x.code==='WITHHOLDING_PERIOD_MISMATCH'));
 assert.equal(r.fields.withholdingPeriod.value,1526.89);
});
test('a duplicate payroll code is preserved for manual review',async()=>{
 const raw=await source('c-alt-terms');
 const altered=raw.replace('90000 Ennakonpidätys', '20040 Ylityö 100 % vrk 4,15 25,07 104,04\n90000 Ennakonpidätys');
 const r=parsePayrollSections(asLayout(altered));
 assert.ok(r.issues.some(x=>x.code==='DUPLICATE_PAYLINE_CODE'));
});
test('unverified withholding summary cannot be silently filled from item code 90000',async()=>{
 const r=parsePayrollSections(asLayout(await source('c-alt-terms')));
 assert.equal(r.fields.withholdingPeriod.status,'missing');
 assert.ok(r.issues.some(x=>x.code==='WITHHOLDING_PERIOD_NOT_VERIFIED'));
});
