/**
 * Import acceptance contract v1 — pure, local, no persistence.
 * Field shape: {value, status:'verified'|'missing'|'ambiguous'|'conflict'|'invalid'|'unverified', sourceIds:string[]}.
 * Inputs are proposals assembled by domain adapters, NOT trustable proof by themselves.
 */
const REQUIRED_PAYROLL=['payDate','grossPay','netPay','ytdTaxableIncome'];
const REQUIRED_HOLDINGS=['quantity','buyPrice','currency'];
const ID_FIELDS=['isin','ticker','name'];
const STATES=new Set(['verified','missing','ambiguous','conflict','invalid','unverified']);

function failure(code, field=null, detail=null){
  return {code,...(field==null?{}:{field}),...(detail==null?{}:{detail})};
}
function validDate(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [y,m,d]=s.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
function validValue(k,v){
  if(k==='payDate')return validDate(v);
  if(['grossPay','netPay','ytdTaxableIncome','previousYearTaxableIncome','withholdingPeriod','withholdingYtd','buyPrice'].includes(k))
    return typeof v==='number'&&Number.isFinite(v)&&v>=0;
  if(k==='quantity')return typeof v==='number'&&Number.isFinite(v)&&v>0;
  if(k==='currency')return typeof v==='string'&&/^[A-Z]{3}$/.test(v);
  if(k==='isin')return typeof v==='string'&&/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v);
  if(k==='mic')return typeof v==='string'&&/^[A-Z0-9]{4}$/.test(v);
  return typeof v==='string'&&v.trim().length>0;
}
function fieldsToCheck(app,fields){
  if(app==='palkka')return REQUIRED_PAYROLL;
  if(app==='osakevahti')return REQUIRED_HOLDINGS;
  return [];
}
/** Never authorize saving. All material observations must be explicitly accounted for. */
export function evaluateImportCandidate(candidate) {
  const problems=[];
  if(!candidate || typeof candidate!=='object')
    return {status:'review-required',canPersist:false,canAutoAccept:false,problems:[failure('INVALID_INPUT')]};
  const {app,documentType,fields={},observations=[],issues=[],accountedEvidenceIds=[]}=candidate;
  if(!['palkka','osakevahti'].includes(app))
    return {status:'review-required',canPersist:false,canAutoAccept:false,problems:[failure('UNKNOWN_APPLICATION')]};
  if(documentType!==(app==='palkka'?'payslip':'holdings'))
    problems.push(failure('UNKNOWN_DOCUMENT_TYPE'));
  if(!Array.isArray(observations)||!Array.isArray(issues)||!Array.isArray(accountedEvidenceIds)||!fields||typeof fields!=='object')
    return {status:'review-required',canPersist:false,canAutoAccept:false,problems:[failure('INVALID_INPUT')]};
  const ids=new Set();
  for(const o of observations){
    if(!o||typeof o.id!=='string'||ids.has(o.id))problems.push(failure('INVALID_SOURCE_OBSERVATION'));
    else ids.add(o.id);
  }
  // Only verified field sources justify a material observation for readiness.
  // Ledger IDs are diagnostic coverage hints, not independent field proof.
  const consumed=new Set();
  for(const id of accountedEvidenceIds)
    if(!ids.has(id))problems.push(failure('BAD_SOURCE_REFERENCE',null,id));
  const required=fieldsToCheck(app,fields);
  for(const k of required){
    if(!fields[k]||fields[k].value===null||fields[k].value===undefined||fields[k].status==='missing')
      problems.push(failure('MISSING_FIELD',k));
  }
  if(app==='osakevahti' && !ID_FIELDS.some(k=>fields[k]?.status==='verified'&&validValue(k,fields[k]?.value)))
    problems.push(failure('NO_INSTRUMENT_ID'));
  for(const [key,f] of Object.entries(fields)){
    if(!f||!STATES.has(f.status)) {problems.push(failure('INVALID_FIELD_STATUS',key));continue;}
    if(f.status==='missing')continue;
    if(f.status==='conflict'){problems.push(failure('CONFLICT',key));continue;}
    if(f.status==='ambiguous'||f.status==='unverified'){problems.push(failure('UNVERIFIED_FIELD',key));continue;}
    if(f.status==='invalid'||!validValue(key,f.value)){problems.push(failure('INVALID_FIELD',key));continue;}
    if(!Array.isArray(f.sourceIds)||f.sourceIds.length===0){
      problems.push(failure('MISSING_SOURCE_EVIDENCE',key));continue;
    }
    for(const id of f.sourceIds){
      if(!ids.has(id))problems.push(failure('BAD_SOURCE_REFERENCE',key,id));
      else consumed.add(id);
    }
  }
  if(app==='palkka' && fields.netPay?.status==='verified' && fields.grossPay?.status==='verified'
      && validValue('netPay',fields.netPay.value) && validValue('grossPay',fields.grossPay.value)
      && fields.netPay.value>fields.grossPay.value)
    problems.push(failure('NET_EXCEEDS_GROSS'));
  for(const issue of issues){
    // Fail closed: unknown issue severity is NOT silently downgraded.
    if(!issue||issue.level!=='info')problems.push(failure('BLOCKING_SOURCE_ISSUE',null,issue?.code??'unknown'));
  }
  for(const observation of observations){
    if(observation?.material===true && !consumed.has(observation.id))
      problems.push(failure('UNACCOUNTED_MATERIAL',null,observation.id));
  }
  const status=problems.length===0?'candidate-ready':'review-required';
  return {status,canAutoAccept:status==='candidate-ready',canPersist:false,problems};
}
