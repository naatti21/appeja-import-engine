import {rowTokens} from './layout.mjs';
import {parseNumber} from './numbers.mjs';
import {evaluateImportCandidate} from './acceptance.mjs';
import {parsePayrollDetailLedger,checkWithholdingReconciliation} from './payroll-lines.mjs';

// Constrained section-based Finnish payslip experiment. Never writes data.
const labeledNumber='(-?[\\d \\u00a0\\u202f]+[,.]\\d{2})';
const moneyRegex=/-?[\d \u00a0\u202f]+,\d{2}/;
const endAmount=new RegExp('^'+labeledNumber+'$');
const headings=[
 [/^kertymä\s+palkkakaudelta$/i,'period'],[/^kauden\s+tiedot$/i,'period'],
 [/^kertymä\s+vuoden\s+alusta$/i,'year'],[/^vuoden\s+tiedot$/i,'year']
];
const taxable=/^(?:ennakonpid(?:ä|\.)?\s*\.?\s*al\.?\s*tul(?:o)?|ver\.?\s*al\.?\s*ans\.?|veronalainen\s+ansio)\s+/i;
const gross=/^(?:veronalainen\s+ansio\s*\/\s*kausi|kauden\s+veronalainen\s+(?:palkka|ansio))\s+/i;
const year=/^(?:vuositulo\s+tähän\s+asti|vuoden\s+veronalainen\s+(?:tulo|ansio))\s+/i;
const net=/^(?:maksetaan|nettopalkka|käteen\s+maksettava)\s+/i;
const withholding=/^(?:ennakonpidätys|enn\.?\s*pid\.?)\s+/i;
const dateLabel=/^(?:maksupäivä|maksupvm|palkanmaksupäivä)\s+/i;
const fieldNames=['payDate','grossPay','netPay','ytdTaxableIncome',
 'previousYearTaxableIncome','withholdingPeriod','withholdingYtd',
 'payPeriodStart','payPeriodEnd'];
const isoDate=str=>{
 const m=String(str).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
 if(!m)return null;
 const [d,mo,y]=m.slice(1).map(Number);
 const dt=new Date(Date.UTC(y,mo-1,d));
 if(dt.getUTCDate()!==d||dt.getUTCMonth()!==mo-1||dt.getUTCFullYear()!==y)return null;
 return [y,String(mo).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
};
function matchMoney(text,label) {
 const m=text.match(label);
 if(!m)return null;
 const tail=text.slice(m[0].length).trim();
 const numeric=tail.match(endAmount);
 if(!numeric)return {error:'UNPARSEABLE_LABELED_AMOUNT'};
 const n=parseNumber(numeric[1]);
 if(n.status!=='valid')return {error:'INVALID_LABELED_AMOUNT'};
 return {value:n.value,raw:numeric[1]};
}
function resolve(list){
 if(!list.length)return {status:'missing',value:null,sourceIds:[],candidates:[]};
 const distinct=[...new Set(list.map(x=>x.value))];
 if(distinct.length>1)return {status:'conflict',value:null,sourceIds:[...new Set(list.flatMap(x=>x.sourceIds))],candidates:list};
 return {status:'verified',value:distinct[0],
   sourceIds:[...new Set(list.flatMap(x=>x.sourceIds))],candidates:list};
}
export function parsePayrollSections(layout) {
 const evidence=Object.fromEntries(fieldNames.map(k=>[k,[]]));
 const issues=(layout.issues??[]).map(i=>({level:'blocking',code:i.code,observationId:i.observationId}));
 let title=false,seenRows=0;
 const add=(key,value,row,raw,headerIds=[],meta={})=>{
   const ids=[...new Set([...headerIds,...row.tokens.map(t=>t.id)])];
   evidence[key].push({value,raw,sourceIds:ids,page:row.page,
     rowId:row.id,observationId:row.tokens[0].id,...meta});
 };
 for(const page of layout.pages??[]){
  let section=null,sectionIds=[];
  for(const sourceRow of page.rows){
   const tokens=rowTokens(layout,sourceRow);
   if(!tokens.length)continue;
   const text=tokens.map(t=>t.raw.trim()).join(' ').replace(/\s+/g,' ').trim();
   const row={tokens,text,id:sourceRow.id,page:page.page};
   seenRows++;
   const header=headings.find(([re])=>re.test(text));
   if(header){section=header[1];sectionIds=tokens.map(t=>t.id);continue;}
   if(/^(?:erittely(?:t|\b)|palkan\s+osat\b|palkkaustiedot\b)/i.test(text))
     {section=null;sectionIds=[];continue;}
   if(/palkkalaskelma|palkkaerittely|palkanmaksun\s+yhteenveto/i.test(text))title=true;
   const bad=(key)=>issues.push({level:'blocking',code:'UNPARSEABLE_LABELED_AMOUNT',
     field:key,page:page.page,observationId:tokens[0].id});
   if(dateLabel.test(text)){
     const date=isoDate(text.replace(dateLabel,'').trim());
     if(date)add('payDate',date,row,text);
     else bad('payDate');
   }
   const pm=text.match(/^(?:palkkakausi(?:\s+\d{4}\/\d+)?|jakso)\s+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{4})$/i);
   if(pm){
     const start=isoDate(pm[1]),end=isoDate(pm[2]);
     if(!start||!end||start>end)issues.push({level:'blocking',code:'INVALID_PAY_PERIOD',observationId:tokens[0].id});
     else {add('payPeriodStart',start,row,pm[1]);add('payPeriodEnd',end,row,pm[2]);}
   }
   const parse=(key,label,headerIds=[],convert=x=>x)=>{
     const v=matchMoney(text,label);
     if(v?.error)bad(key);
     else if(v)add(key,convert(v.value),row,v.raw,headerIds,
       key.startsWith('withholding')?{signedValue:v.value}:{});
     return v;
   };
   parse('netPay',net);
   const explicitGross=parse('grossPay',gross);
   parse('ytdTaxableIncome',year);
   // Explicit "veronalainen ansio / kausi" must not also be parsed as a
   // shorter generic "veronalainen ansio" label with an invalid suffix.
   const tax=explicitGross?null:matchMoney(text,taxable);
   if(tax?.error)bad('taxable');
   else if(tax){
     if(section==='period')add('grossPay',tax.value,row,tax.raw,sectionIds);
     else if(section==='year')add('ytdTaxableIncome',tax.value,row,tax.raw,sectionIds);
     else if(/^ver\.?\s*al\.?\s*ans/i.test(text))add('grossPay',tax.value,row,tax.raw);
     else issues.push({level:'blocking',code:'UNATTRIBUTED_TAXABLE_AMOUNT',observationId:tokens[0].id});
   }
   const wh=matchMoney(text,withholding);
   if(wh?.error)bad('withholding');
   else if(wh){
     const role=section==='period'?'withholdingPeriod':section==='year'?'withholdingYtd':null;
     if(!role)issues.push({level:'blocking',code:'UNATTRIBUTED_WITHHOLDING',observationId:tokens[0].id});
     else if(wh.value>0)issues.push({level:'blocking',code:'UNEXPECTED_WITHHOLDING_SIGN',observationId:tokens[0].id});
     else add(role,Math.abs(wh.value),row,wh.raw,sectionIds,{signedValue:wh.value});
   }
  }
 }
 const fields=Object.fromEntries(fieldNames.map(k=>[k,resolve(evidence[k])]));
 const ledger=parsePayrollDetailLedger(layout);
 issues.push(...ledger.issues,...checkWithholdingReconciliation(ledger,fields.withholdingPeriod));
 if(!title)issues.push({level:'blocking',code:'UNKNOWN_PAYSLIP_TYPE'});
 const observations=(layout.observations??[]).map(o=>({
  id:o.id,raw:o.raw,page:o.page,box:o.box,material:moneyRegex.test(o.raw)
 }));
 const accountedEvidenceIds=ledger.coveredSourceIds;
 const decision=evaluateImportCandidate({app:'palkka',
  documentType:title?'payslip':'unknown',fields,observations,issues,accountedEvidenceIds});
 const coveredIds=new Set([
   ...accountedEvidenceIds,
   ...Object.values(fields).flatMap(f=>f.status==='verified'?f.sourceIds:[])
 ]);
 const material=observations.filter(o=>o.material);
 const matched=material.filter(o=>coveredIds.has(o.id));
 const coverage={materialObservations:material.length,coveredObservations:matched.length,
   unresolvedObservations:material.length-matched.length,
   unresolvedIds:material.filter(o=>!coveredIds.has(o.id)).map(o=>o.id),
   paylineRowsRecognized:ledger.payLines.length,paylineRowsUnrecognized:ledger.unknown.length};
 return {schemaVersion:2,adapter:'payroll-sections-experiment',fields,evidence,
  payLines:ledger.payLines,unmatchedPayLines:ledger.unknown,
  coverage,issues,observations,rows:seenRows,decision,canPersist:false};
}
