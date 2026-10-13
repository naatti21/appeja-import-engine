// Supplemental in-memory regression probes, not DEV/PDF.js accuracy measurements.
import fs from 'node:fs';
import {rowsFromObservations} from '../../src/layout.mjs';
import {parsePayrollSections} from '../../src/payroll-sections.mjs';
import {parsePayrollSectionsVocabulary} from './semantic-parser.mjs';
import {structureLayout} from './structure.mjs';
function fixture(lines){
 const observations=lines.flatMap(([y,parts],ri)=>parts.map(([x,raw,width=0.15],ti)=>({id:`r${ri}t${ti}`,raw,page:1,kind:'text',box:{x0:x,x1:x+width,y0:y,y1:y+0.01},method:'synthetic-regression'})));
 return {observations,pages:[{page:1,width:600,height:840,rows:rowsFromObservations(observations,1),observationIds:observations.map(o=>o.id)}],issues:[]};
}
const cases=[
 {id:'foreign-aliases',lines:[[0.02,[[0.05,'Invoice']]], [0.10,[[0.05,'Gross pay'],[0.7,'100,00']]], [0.15,[[0.05,'Net'],[0.7,'80,00']]]],check:p=>p.fields.grossPay.status!=='verified'&&p.decision.status==='review-required'},
 {id:'tax-card-qualified-label',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.1,[[0.05,'Verokortin veronalainen palkkakertymä',0.5],[0.7,'999,00']]]],check:p=>p.fields.ytdTaxableIncome.status!=='verified'},
 {id:'tax-card-section',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.08,[[0.05,'Verokortti']]], [0.13,[[0.05,'Taxable YTD'],[0.7,'999,00']]]],check:p=>p.fields.ytdTaxableIncome.status!=='verified'},
 {id:'year-section-not-period-gross',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.08,[[0.05,'Vuoden tiedot']]], [0.13,[[0.05,'Ansiot yhteensä'],[0.7,'999,00']]]],check:p=>p.fields.grossPay.status!=='verified'},
 {id:'ambiguous-three-decimals',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.13,[[0.05,'Net'],[0.7,'1,234']]]],check:p=>p.fields.netPay.status!=='verified'&&p.decision.status==='review-required'},
 {id:'competing-vertical-values',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.1,[[0.05,'CURRENT PAY',0.2],[0.65,'YEAR TRACKER',0.2]]], [0.14,[[0.05,'Net',0.05]]], [0.155,[[0.15,'100,00',0.08]]], [0.17,[[0.15,'200,00',0.08]]]],check:p=>p.fields.netPay.status!=='verified'},
 {id:'contradictory-same-role',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.13,[[0.05,'Nettopalkka'],[0.7,'100,00']]], [0.18,[[0.05,'Nettopalkka'],[0.7,'200,00']]]],check:p=>p.fields.netPay.status==='conflict'&&p.fields.netPay.candidates.length===2&&p.decision.status==='review-required'},
 {id:'previous-transfer-not-net',lines:[[0.02,[[0.05,'Palkkalaskelma']]], [0.13,[[0.05,'Edellinen tilisiirto'],[0.7,'200,00']]]],check:p=>p.fields.netPay.status==='missing'&&p.fields.netPay.value===null}
];
const results=[];
for(const c of cases){
 const base=fixture(c.lines);
 for(const name of ['A','B','C','D']){
  const layout=['B','D'].includes(name)?structureLayout(structuredClone(base)):structuredClone(base);
  const parsed=['C','D'].includes(name)?parsePayrollSectionsVocabulary(layout):parsePayrollSections(layout);
  results.push({id:c.id,variant:name,pass:c.check(parsed),layout,parsed});
 }
}
const output=process.argv[2]??'research/ablation-layout-vocab-v1/REGRESSION_RESULTS.json';
fs.writeFileSync(output,JSON.stringify({scope:'Supplemental synthetic observations, no PDF.js; not DEV accuracy',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({id,variant,pass})=>({id,variant,pass})),null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
