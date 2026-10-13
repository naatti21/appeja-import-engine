/** Local-only, source-linked salary detail row ledger. Synthetic validated grammar. */
import {rowTokens} from './layout.mjs';
import {parseNumber} from './numbers.mjs';

const RULES=new Map([
 ['13001',{name:'piecework',label:/^palkkiotyö$/i,factor:1}],
 ['13101',{name:'drill-bonus',label:/^porakonepalkkio$/i,factor:1}],
 ['20040',{name:'overtime-100-day',label:/^ylityö 100 % vrk$/i,factor:1}],
 ['20050',{name:'overtime-50-week',label:/^ylityö 50 % vko$/i,factor:0.5}],
 ['20060',{name:'overtime-100-week',label:/^ylityö 100 % vko$/i,factor:1}],
 ['20070',{name:'overtime-50-contract',label:/^tes ylityö 50 %$/i,factor:0.5}],
 ['20110',{name:'sunday',label:/^sunnuntaityö$/i,factor:1}],
 ['20120',{name:'weekly-rest',label:/^viikkovapaakorvaus$/i,factor:1}],
 ['20511',{name:'worktime-bank-use',label:/^työaikapankista käyttö$/i,factor:1}],
 ['20512',{name:'worktime-bank-add',label:/^työaikapankin lisäys$/i,factor:1}],
 ['30020',{name:'evening-bonus',label:/^iltavuorolisä$/i,factor:1}],
 ['90000',{name:'withholding',label:/^ennakonpidätys$/i,tax:true}]
]);
const N='(-?\\d+(?:[ \\u00a0\\u202f]\\d{3})*,\\d{2})';
const earning=new RegExp('^(\\d{4,6})\\s+(.+?)\\s+'+N+'\\s+'+N+'\\s+'+N+'$');
const taxline=new RegExp('^(\\d{4,6})\\s+(.+?)\\s+'+N+'\\s+'+N+'$');

export function parsePayrollDetailLedger(layout){
 const payLines=[],issues=[],coveredSourceIds=[],unknown=[];
 const seenCode=new Set();
 for(const page of layout.pages??[]){
  let details=false;
  for(const sourceRow of page.rows){
   const tokens=rowTokens(layout,sourceRow);
   if(!tokens.length)continue;
   const text=tokens.map(t=>t.raw.trim()).join(' ').replace(/\s+/g,' ').trim();
   if(/^(?:erittely(?:t)?\b|palkan osat\b)/i.test(text)){details=true;continue;}
   if(/^(?:kertymä\b|kauden tiedot\b|vuoden tiedot\b)/i.test(text)){details=false;continue;}
   if(!details)continue;
   const sourceIds=tokens.map(t=>t.id);
   const src={page:page.page,rowId:sourceRow.id,sourceIds,raw:text};
   const fail=(code)=>{
    issues.push({level:'blocking',code,observationId:tokens[0].id,page:page.page});
    unknown.push({...src,reason:code});
   };
   if(!/^\d{4,6}\s/.test(text)){
    if(/\d[ \d]*,\d{2}/.test(text))fail('UNLABELED_PAYLINE_MONEY');
    continue;
   }
   const m=text.match(earning)??text.match(taxline);
   if(!m){fail('MALFORMED_PAYLINE');continue;}
   const [_,code,label,...numbers]=m;
   const rule=RULES.get(code);
   if(!rule){fail('UNKNOWN_PAYLINE_CODE');continue;}
   if(!rule.label.test(label.trim())){fail('PAYLINE_LABEL_MISMATCH');continue;}
   if(Boolean(rule.tax)!==(numbers.length===2)){
    fail('PAYLINE_COLUMN_COUNT');continue;
   }
   const parsed=numbers.map(value=>parseNumber(value));
   if(parsed.some(n=>n.status!=='valid')){fail('INVALID_PAYLINE_NUMBER');continue;}
   const values=parsed.map(n=>n.value);
   const row=rule.tax?
     {...src,code,label,category:rule.name,quantity:null,unitPrice:null,
       taxCardAccumulatedIncome:values[0],amount:values[1]}:
     {...src,code,label,category:rule.name,quantity:values[0],unitPrice:values[1],
       amount:values[2],factor:rule.factor};
   if(seenCode.has(code)){fail('DUPLICATE_PAYLINE_CODE');continue;}
   seenCode.add(code);
   if(rule.tax){
    if(row.taxCardAccumulatedIncome<0||row.amount>=0){
     fail('INVALID_WITHHOLDING_PAYLINE');continue;
    }
   }else{
    const expected=row.quantity*row.unitPrice*row.factor;
    // Source values are rounded cents: permit small multiplication discrepancy.
    if(Math.abs(row.amount-expected)>0.025){
     fail('PAYLINE_ARITHMETIC_MISMATCH');continue;
    }
   }
   payLines.push(row);
   coveredSourceIds.push(...sourceIds);
  }
 }
 return {payLines,issues,coveredSourceIds:[...new Set(coveredSourceIds)],unknown,
   checkedRows:payLines.length+unknown.length};
}

export function checkWithholdingReconciliation(ledger,withholdingPeriod){
 const rows=ledger.payLines.filter(line=>line.category==='withholding');
 if(!rows.length)return [];
 if(withholdingPeriod.status!=='verified')
   return [{level:'blocking',code:'WITHHOLDING_PERIOD_NOT_VERIFIED'}];
 const val=rows[0].amount;
 return Math.abs(Math.abs(val)-withholdingPeriod.value)<=0.011?[]:
   [{level:'blocking',code:'WITHHOLDING_PERIOD_MISMATCH',
      observationId:rows[0].sourceIds[0]}];
}
