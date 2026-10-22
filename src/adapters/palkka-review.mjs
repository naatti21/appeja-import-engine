/** Palkka adapter: keep salary fields and validation independent from holdings. */
import {createDomainReview} from './shared-review.mjs';

const fields=['payDate','payPeriodStart','payPeriodEnd','grossPay','netPay',
  'ytdTaxableIncome','previousYearTaxableIncome','withholdingPeriod','withholdingYtd'];
export function createPalkkaReview({source,parsed}={}){
 if(!parsed || typeof parsed!=='object'||!parsed.fields)
   throw new TypeError('INVALID_PAYROLL_RESULT');
 const candidate=Object.fromEntries(
   Object.entries(parsed.fields).filter(([key])=>fields.includes(key))
     .map(([key,v])=>[key,{value:v?.value??null,
       status:v?.status||'missing',sourceIds:v?.sourceIds||[],role:v?.role}])
 );
 const issues=(parsed.issues||[]).map(x=>({code:'PAYROLL_PARSER_ISSUE',detail:x.code}));
 if(parsed.decision?.status==='review-required')issues.push({code:'PAYROLL_DECISION_REVIEW_REQUIRED'});
 return createDomainReview({documentType:'payroll',source,
  records:[{id:'payslip-1',fields:candidate}],allowedFields:fields,
  requiredFields:['payDate','grossPay','netPay','ytdTaxableIncome'],issues});
}
