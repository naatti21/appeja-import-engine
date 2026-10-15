/** Research-only coverage gate. No annotation input, no parser changes or persistence. */
const validBox=b=>b&&['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))&&
 b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
const fail=code=>({status:'review-required',canAutoAccept:false,canPersist:false,
 newWarnings:[],existingWarnings:[],exemptions:[],issues:[{code}],groups:[]});
function number(raw){
 const s=raw.trim().replace(/\u2212/g,'-');
 // Validate full grouping before removing whitespace; never accept "12 34" as 1234.
 if(!/^[+-]?(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(s))return null;
 const n=Number(s.replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
 return Number.isFinite(n)?n:null;
}
function sourceValueMatches(value,sources){
 if(typeof value==='string')return sources.some(o=>o.raw.trim()===value);
 if(typeof value!=='number'||!Number.isFinite(value))return false;
 const numeric=sources.filter(o=>/\p{N}/u.test(o.raw));
 if(!numeric.length)return false;
 const joined=numeric.map(o=>o.raw.trim()).join(' ');
 return number(joined)===value;
}
function paylineMatches(row,sources){
 if(row.status!==undefined&&!['verified','complete'].includes(row.status))return false;
 const values=sources.map(o=>number(o.raw)).filter(n=>n!==null);
 if(typeof row.code!=='string'||!/^\d{4,6}$/.test(row.code)||!values.includes(Number(row.code)))return false;
 const exactValues=expected=>values.length===expected.length&&
  [...values].sort((a,b)=>a-b).every((v,i)=>v===[...expected].sort((a,b)=>a-b)[i]);
 if(row.category==='withholding')return Number.isFinite(row.taxCardAccumulatedIncome)&&
  row.taxCardAccumulatedIncome>=0&&row.amount<0&&
  exactValues([Number(row.code),row.taxCardAccumulatedIncome,row.amount]);
 return [row.quantity,row.unitPrice,row.factor,row.amount].every(Number.isFinite)&&
  row.quantity>=0&&row.unitPrice>=0&&row.factor>0&&
  Math.abs(row.quantity*row.unitPrice*row.factor-row.amount)<=.025&&
  exactValues([Number(row.code),row.quantity,row.unitPrice,row.amount]);
}
function benignMetadata(o){
 if(!validBox(o.box))return null;
 const raw=o.raw.trim();
 // Exact grammar + physical location. Never exempt money merely because it is in a footer.
 if(o.box.y0>=.92&&/^(?:Page\s+\d{1,3}\s+(?:of|\/)\s*\d{1,3}|Sivu\s+\d{1,3}\s*\/\s*\d{1,3}|Sida\s+\d{1,3}\s+av\s+\d{1,3})$/i.test(raw))return 'PAGE_COUNTER';
 if(o.box.y1<=.1&&/^Document ID:\s*SYN-[A-Z0-9-]{1,30}$/i.test(raw))return 'SYNTHETIC_DOCUMENT_ID';
 if(o.box.y1<=.1&&/^Version:\s*\d{1,2}(?:\.\d{1,2}){0,2}$/i.test(raw))return 'VERSION_METADATA';
 if(o.box.y1<=.1&&raw==='SYNTHETIC TEST DOCUMENT')return 'SYNTHETIC_HEADING';
 return null;
}
/** Group by overlapping row geometry; no crossing pages or transitive vertical chaining. */
export function groupWarnings(warnings){
 const sorted=[...warnings].sort((a,b)=>a.page-b.page||
  (a.box?.y0??2)-(b.box?.y0??2)||(a.box?.x0??2)-(b.box?.x0??2)||a.sourceId.localeCompare(b.sourceId));
 const groups=[];
 for(const w of sorted){
  const group=validBox(w.box)?groups.find(g=>g.page===w.page&&g.anchor&&
   Math.min(g.anchor.y1,w.box.y1)>Math.max(g.anchor.y0,w.box.y0)):null;
  if(group){group.sourceIds.push(w.sourceId);group.warnings.push(w);}
  else groups.push({page:w.page,anchor:validBox(w.box)?{...w.box}:null,sourceIds:[w.sourceId],warnings:[w]});
 }
 return groups;
}
export function auditSourceCoverage(layout,parsed){
 if(!Array.isArray(layout?.observations)||!parsed||typeof parsed!=='object'||
  !parsed.decision||typeof parsed.decision!=='object'||
  !Array.isArray(parsed.decision.problems??[])||
  !parsed.fields||typeof parsed.fields!=='object'||Array.isArray(parsed.fields)||
  !Array.isArray(parsed.payLines??[]))return fail('INVALID_COVERAGE_INPUT');
 const byId=new Map(),issues=[];
 for(const o of layout.observations){
  if(!o||typeof o.id!=='string'||!o.id.trim()||byId.has(o.id)||
   typeof o.raw!=='string'||!Number.isInteger(o.page)||o.page<1)return fail('INVALID_SOURCE_OBSERVATION');
  if(o.box!==undefined&&o.box!==null&&!validBox(o.box))return fail('INVALID_SOURCE_BOX');
  byId.set(o.id,o);
 }
 const linked=new Set(),suspect=new Map();
 const inspect=(ids,matcher,code)=>{
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))return false;
  const sources=ids.map(id=>byId.get(id)).sort((a,b)=>a.page-b.page||
   (a.box?.y0??0)-(b.box?.y0??0)||(a.box?.x0??0)-(b.box?.x0??0));
  if(!matcher(sources)){for(const id of ids)suspect.set(id,code);}
  else for(const id of ids)linked.add(id);
  return true;
 };
 for(const f of Object.values(parsed.fields)){
  if(f?.status!=='verified')continue;
  if(!inspect(f.sourceIds,sources=>sourceValueMatches(f.value,sources),'SOURCE_VALUE_NOT_REPRODUCED'))return fail('INVALID_VERIFIED_SOURCE');
 }
 for(const row of parsed.payLines??[]){
  if(!row||!inspect(row.sourceIds,sources=>paylineMatches(row,sources),'PAYLINE_NOT_REPRODUCED'))return fail('INVALID_PAYLINE_SOURCE');
 }
 // A dubious association cannot be hidden by a second, otherwise valid association.
 for(const id of suspect.keys())linked.delete(id);
 const existingWarnings=[];
 for(const p of parsed.decision.problems??[]){
  if(!p||typeof p!=='object'||typeof p.code!=='string')return fail('INVALID_UPSTREAM_PROBLEM');
  if(p.code==='UNACCOUNTED_MATERIAL'&&p.level!=='info'){
   if(typeof p.detail!=='string'||!byId.has(p.detail))return fail('INVALID_WARNING_SOURCE');
   const o=byId.get(p.detail);existingWarnings.push({code:p.code,sourceId:o.id,page:o.page,box:o.box??null});
  }
 }
 const already=new Set(existingWarnings.map(w=>w.sourceId)),newWarnings=[],exemptions=[];
 for(const o of byId.values()){
  if(linked.has(o.id)||already.has(o.id)||!o.raw.trim())continue;
  const benign=suspect.has(o.id)?null:benignMetadata(o);
  if(benign){exemptions.push({sourceId:o.id,reason:benign,page:o.page,box:o.box});continue;}
  newWarnings.push({code:suspect.get(o.id)??'UNREVIEWED_SOURCE_OBSERVATION',sourceId:o.id,page:o.page,box:o.box??null});
 }
 const upstreamBlocked=parsed.decision.status!=='candidate-ready'||parsed.decision.canAutoAccept!==true||
  parsed.decision.problems.some(p=>p.level!=='info');
 const blocked=upstreamBlocked||newWarnings.length>0||issues.length>0;
 return {status:blocked?'review-required':'candidate-ready',canAutoAccept:!blocked,canPersist:false,
  newWarnings,existingWarnings,exemptions,issues,groups:groupWarnings(newWarnings),
  summary:{totalObservations:byId.size,linkedObservations:linked.size,newlyWarned:newWarnings.length,
   alreadyWarned:already.size,exemptions:exemptions.length}};
}
