import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutFromPdfItems} from '../src/layout.mjs';
import {parsePayrollSections} from '../src/payroll-sections.mjs';

function layoutFromPages(pages){
 const height=1000,width=1300;
 return layoutFromPdfItems(pages.map(lines=>({width,height,items:lines.map((text,i)=>({
  str:text,width:Math.min(1000,Math.max(80,text.length*7)),
  height:12,transform:[12,0,0,12,60,height-30-i*27]
 }))})));
}
function layoutFromLines(lines){return layoutFromPages([lines]);}
const base=[
 'PALKKALASKELMA',
 'Palkkakausi 3.8.2026 - 16.8.2026',
 'Maksupäivä 28.8.2026',
 'Maksetaan 2 678,39',
 'KERTYMÄ PALKKAKAUDELTA',
 'Ennakonpid. al. tul 4 698,11',
 'Ennakonpidätys -1 526,89',
 'KERTYMÄ VUODEN ALUSTA',
 'Ennakonpid. al. tul 63 832,82',
 'Ennakonpidätys -18 792,51'
];
test('section payroll 4 mandatory fields recognized with original IDs',()=>{
 const r=parsePayrollSections(layoutFromLines(base));
 assert.deepEqual(['grossPay','netPay','ytdTaxableIncome','payDate'].map(k=>r.fields[k].value),
  [4698.11,2678.39,63832.82,'2026-08-28']);
 for(const k of ['grossPay','netPay','ytdTaxableIncome','payDate']){
  assert.equal(r.fields[k].status,'verified');
  assert.ok(r.fields[k].sourceIds.length>0);
  for(const id of r.fields[k].sourceIds)assert.ok(r.observations.some(t=>t.id===id));
 }
 assert.equal(r.fields.withholdingPeriod.value,1526.89);
 assert.equal(r.fields.withholdingYtd.value,18792.51);
 assert.equal(r.canPersist,false);
});
test('independent YTD mismatch within same section is a conflict',()=>{
 const r=parsePayrollSections(layoutFromLines([...base,'Ennakonpid. al. tul 63 833,82']));
 assert.equal(r.fields.ytdTaxableIncome.status,'conflict');
 assert.ok(r.decision.problems.some(p=>p.code==='CONFLICT'));
});
test('identical repeated YTD retains both source observations',()=>{
 const r=parsePayrollSections(layoutFromLines([...base,'Ennakonpid. al. tul 63 832,82']));
 assert.equal(r.fields.ytdTaxableIncome.status,'verified');
 assert.equal(r.fields.ytdTaxableIncome.candidates.length,2);
 assert.equal(new Set(r.fields.ytdTaxableIncome.candidates.map(c=>c.observationId)).size,2);
});
test('missing YTD does not borrow previous page or payroll line amounts',()=>{
 const r=parsePayrollSections(layoutFromLines(base.filter(x=>!x.includes('63 832,82'))));
 assert.equal(r.fields.ytdTaxableIncome.status,'missing');
 assert.ok(r.decision.problems.some(p=>p.code==='MISSING_FIELD'&&p.field==='ytdTaxableIncome'));
});
test('withholding in year section is never period withholding',()=>{
 const r=parsePayrollSections(layoutFromLines([...base,'Ennakonpidätys -18 793,51']));
 assert.equal(r.fields.withholdingYtd.status,'conflict');
 assert.equal(r.fields.withholdingPeriod.value,1526.89);
 assert.ok(r.decision.problems.some(p=>p.code==='CONFLICT'&&p.field==='withholdingYtd'));
});
test('unattributed withholding outside a named section never guessed',()=>{
 const r=parsePayrollSections(layoutFromLines(['Palkkalaskelma','Ennakonpidätys -1 526,89',...base.slice(1)]));
 assert.ok(r.issues.some(i=>i.code==='UNATTRIBUTED_WITHHOLDING'));
 assert.equal(r.canPersist,false);
});
test('cross-field arithmetic catches net greater than gross',()=>{
 const r=parsePayrollSections(layoutFromLines(base.map(s=>s.replace('Maksetaan 2 678,39','Maksetaan 5 678,39'))));
 assert.ok(r.decision.problems.some(p=>p.code==='NET_EXCEEDS_GROSS'));
});
test('invalid source date fails closed',()=>{
 const r=parsePayrollSections(layoutFromLines(base.map(s=>s.replace('28.8.2026','32.8.2026'))));
 assert.equal(r.fields.payDate.status,'missing');
 assert.ok(r.issues.some(i=>i.field==='payDate'));
});
test('explicit alternative labels work without cumulative headings',()=>{
 const r=parsePayrollSections(layoutFromLines([
 'Palkanmaksun yhteenveto','Jakso 3.8.2026 - 16.8.2026',
 'Palkanmaksupäivä 28.8.2026','Käteen maksettava 2 678,39',
 'Veronalainen ansio / kausi 4 698,11','Vuositulo tähän asti 63 832,82'
 ]));
 assert.equal(r.fields.grossPay.value,4698.11);
 assert.equal(r.fields.ytdTaxableIncome.value,63832.82);
 assert.equal(r.fields.netPay.value,2678.39);
 assert.equal(r.fields.payDate.value,'2026-08-28');
});
test('unlabeled extra money must remain visible and block',()=>{
 const r=parsePayrollSections(layoutFromLines([...base,'43000,00']));
 assert.ok(r.decision.problems.some(p=>p.code==='UNACCOUNTED_MATERIAL'));
});

test('two PDF pages with contradictory annual taxable income preserve both sources',()=>{
 const other=base.map(s=>s.replace('63 832,82','63 833,82'));
 const r=parsePayrollSections(layoutFromPages([base,other]));
 assert.equal(r.fields.ytdTaxableIncome.status,'conflict');
 assert.deepEqual(r.fields.ytdTaxableIncome.candidates.map(c=>c.page),[1,2]);
 assert.equal(r.decision.canPersist,false);
});
