/**
 * Reusable, local-only Import Engine -> app review boundary.
 * Domain-specific parsers supply semantic roles; this adapter cannot invent them.
 * No instrument lookup, salary/portfolio storage or auto-approval here.
 */
import {createReviewDraft} from './review-draft.mjs';

const STATUSES=new Set(['candidate','verified','valid','observed','missing','ambiguous','conflict','invalid','unverified']);
const FIELD=/^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const VALUE_OK=v=>v===null||typeof v==='string'||typeof v==='boolean'||
  (typeof v==='number'&&Number.isFinite(v));

export function createDomainReview({documentType,source,records,allowedFields,requiredFields=[],issues=[]}={}){
 if(!['holdings','payroll'].includes(documentType)||!source||!Array.isArray(records)||
    !Array.isArray(allowedFields)||!Array.isArray(requiredFields)||!Array.isArray(issues))
   throw new TypeError('INVALID_DOMAIN_REVIEW_CONTRACT');
 const allowed=new Set(allowedFields);
 const adapterProblems=[...issues.map(x=>({...x}))];
 const candidates=records.map((record,index)=>{
   const fields=Object.create(null);
   for(const [key,raw] of Object.entries(record?.fields||{})){
     if(!FIELD.test(key)||!allowed.has(key)){
       adapterProblems.push({code:'UNSUPPORTED_DOMAIN_FIELD',recordId:record?.id??String(index),field:key});
       continue;
     }
     if(!raw||!STATUSES.has(raw.status)||!VALUE_OK(raw.value)||!Array.isArray(raw.sourceIds))
       throw new TypeError('INVALID_DOMAIN_CANDIDATE');
     let status=raw.status;
     // A parser's "verified" means value-level evidence, NOT a financial role,
     // account or identity approval. Never promote it to a save permission.
     if(['verified','observed','valid'].includes(status))status='candidate';
     if(raw.value===null&&status==='candidate')status='missing';
     if(raw.role && raw.role!==key){
       adapterProblems.push({code:'FIELD_ROLE_CONFLICT',recordId:record.id,field:key});
       status='conflict';
     }
     if((status==='candidate'||status==='unverified')&&raw.sourceIds.length===0){
       adapterProblems.push({code:'SOURCE_FOR_CANDIDATE_MISSING',recordId:record.id,field:key});
       status='unverified';
     }
     fields[key]={value:raw.value,status,sourceIds:[...raw.sourceIds]};
   }
   for(const required of requiredFields){
     if(!allowed.has(required))throw new TypeError('INVALID_REQUIRED_DOMAIN_FIELD');
     if(!fields[required]){
       fields[required]={value:null,status:'missing',sourceIds:[]};
       adapterProblems.push({code:'REQUIRED_FIELD_MISSING',recordId:record.id,field:required});
     }else if(!['candidate'].includes(fields[required].status)){
       adapterProblems.push({code:'REQUIRED_FIELD_REVIEW',recordId:record.id,field:required});
     }
   }
   return {id:record.id,fields};
 });
 return createReviewDraft({documentType,source,records:candidates,adapterProblems});
}
