/** Isolated safety wrapper. Frozen v2 still owns warning grouping and metadata policy. */
import {auditSourceCoverage as auditV2,groupWarnings} from '../coverage-gate-v2/gate.mjs';
const box=b=>b&&['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))&&
 b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
const sameRow=(a,b)=>a.page===b.page&&box(a.box)&&box(b.box)&&
 Math.min(a.box.y1,b.box.y1)>Math.max(a.box.y0,b.box.y0);
const overlaps=(a,b)=>sameRow(a,b)&&Math.min(a.box.x1,b.box.x1)>Math.max(a.box.x0,b.box.x0);
const ordered=xs=>[...xs].sort((a,b)=>a.page-b.page||(a.box?.y0??0)-(b.box?.y0??0)||
 (a.box?.x0??0)-(b.box?.x0??0)||a.id.localeCompare(b.id));
function number(raw){
 const s=raw.trim().replace(/\u2212/g,'-');
 if(!/^[+-]?(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(s))return null;
 const n=Number(s.replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
 return Number.isFinite(n)?n:null;
}
function adjacent(xs){
 return xs.length===1||xs.every((o,i)=>box(o.box)&&sameRow(xs[0],o)&&
  (!i||(o.box.x0>=xs[i-1].box.x1&&o.box.x0-xs[i-1].box.x1<=.06)));
}
function valueMatches(value,sources){
 const xs=ordered(sources);
 if(!xs.length||!adjacent(xs)||xs.some(o=>!o.raw.trim()))return false;
 const texts=[xs.map(o=>o.raw.trim()).join(' '),xs.map(o=>o.raw.trim()).join('')];
 if(typeof value==='number'&&Number.isFinite(value)){
  // Pure digit chunks may be separate values: no invented concatenation of "12" + "34".
  const punctuation=xs.some(o=>/^[+\-−.,]$|^[.,]\d{1,2}$|\d[.,]$/.test(o.raw.trim()));
  const matches=new Set((punctuation?texts:texts.slice(0,1)).map(number).filter(n=>n!==null));
  return matches.size===1&&matches.has(value);
 }
 // Consume the ENTIRE string source set; one matching date never licenses extra sources.
 return typeof value==='string'&&value.trim().length>0&&texts.includes(value);
}
const headings={
 payDate:['Payment date','Pay date','Maksupäivä','Betalningsdag'],
 grossPay:['Gross pay','Gross','Brutto'],netPay:['Net pay','Net','Netto'],
 ytdTaxableIncome:['Taxable YTD','Veronalainen kertymä'],
 quantity:['Quantity','Määrä','Antal'],buyPrice:['Buy price','Hankintahinta'],
 currentPrice:['Current price','Nykykurssi'],marketValue:['Market value','Nykyarvo']
};
const fold=s=>s.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
function headerMatches(key,headers,values){
 if(!headers.length)return true;
 const hs=ordered(headers),vs=ordered(values);
 return adjacent(hs)&&headings[key]?.some(h=>fold(h)===fold(hs.map(o=>o.raw.trim()).join(' ')))&&
  hs.every(h=>sameRow(h,vs[0]))&&hs.at(-1).box.x1<=vs[0].box.x0&&
  vs[0].box.x0-hs.at(-1).box.x1<=.3;
}
function contextToken(raw){
 let m=raw.trim().match(/^(?:Currency:\s*)?(EUR|USD|SEK|GBP|JPY)$/);
 if(m)return ['currency',m[1]];
 m=raw.trim().match(/^Period:\s*(\d{4}-(?:0[1-9]|1[0-2]))$/);
 if(m)return ['period',m[1]];
 m=raw.trim().match(/^Account:\s*(SYN-[A-Z0-9-]{1,30})$/);
 return m?['account',m[1]]:null;
}
function contextMatches(context,sources,values){
 if(context===undefined)return sources.length===0;
 if(!context||typeof context!=='object'||Array.isArray(context))return false;
 const expected=Object.keys(context);
 if(expected.some(k=>!['currency','period','account'].includes(k)))return false;
 const seen=new Set();
 for(const o of sources){
  const pair=contextToken(o.raw);
  if(!pair||context[pair[0]]!==pair[1]||!sameRow(o,values[0])||
   Math.min(...values.map(v=>Math.abs(o.box.x0-v.box.x0)))>.3)return false;
  seen.add(pair[0]);
 }
 return expected.length===seen.size&&expected.every(k=>seen.has(k));
}
const fail=code=>({status:'review-required',canAutoAccept:false,canPersist:false,
 issues:[{code}],newWarnings:[],existingWarnings:[],exemptions:[],groups:[],validatedEvidence:[]});
export function auditSourceCoverage(layout,parsed){
 if(!Array.isArray(layout?.observations)||!parsed?.fields||typeof parsed.fields!=='object'||
  Array.isArray(parsed.fields)||!parsed.decision||!Array.isArray(parsed.payLines??[]))return fail('INVALID_SOURCE_EVIDENCE_INPUT');
 const byId=new Map();
 for(const o of layout.observations){
  if(!o||typeof o.id!=='string'||!o.id.trim()||byId.has(o.id)||typeof o.raw!=='string'||
   !Number.isInteger(o.page)||o.page<1||(o.box!=null&&!box(o.box)))return fail('INVALID_SOURCE_OBSERVATION');
  byId.set(o.id,o);
 }
 const issues=[],badIds=new Map(),claims=new Map(),fields={},validatedEvidence=[];
 const reject=(code,owner,ids)=>{
  issues.push({code,owner,sourceIds:ids.filter(id=>byId.has(id))});
  for(const id of ids)if(byId.has(id))badIds.set(id,code);
 };
 const idsOk=ids=>Array.isArray(ids)&&ids.every(id=>typeof id==='string'&&byId.has(id))&&new Set(ids).size===ids.length;
 const claim=(id,role,owner,meaning)=>{
  const previous=claims.get(id)??[];
  if(previous.some(p=>p.role!==role||role==='value'||p.meaning!==meaning)){
   reject('SOURCE_ROLE_OR_OWNER_COLLISION',owner,[id]);
  }
  previous.push({role,owner,meaning});claims.set(id,previous);
 };
 for(const [key,f]of Object.entries(parsed.fields)){
  if(f?.status!=='verified')continue;
  const owner='field:'+key,typed=f.sourceRoles;
  if(typed!==undefined&&(!typed||typeof typed!=='object'||Array.isArray(typed)||
   Object.keys(typed).some(k=>!['valueIds','headerIds','contextIds'].includes(k)))){
   reject('INVALID_SOURCE_ROLES',owner,Array.isArray(f.sourceIds)?f.sourceIds:[]);continue;
  }
  const values=typed?typed.valueIds:f.sourceIds,headers=typed?(typed.headerIds??[]):[],contexts=typed?(typed.contextIds??[]):[];
  const all=[values,headers,contexts].flatMap(ids=>Array.isArray(ids)?ids:[]);
  if(!idsOk(values)||!values.length||!idsOk(headers)||!idsOk(contexts)||new Set(all).size!==all.length||
   (typed&&f.sourceIds!==undefined&&(!idsOk(f.sourceIds)||f.sourceIds.length!==all.length||f.sourceIds.some(id=>!all.includes(id))))){
   reject('INVALID_OR_SURPLUS_SOURCE_IDS',owner,[...all,...(Array.isArray(f.sourceIds)?f.sourceIds:[])]);continue;
  }
  const vs=values.map(id=>byId.get(id)),hs=headers.map(id=>byId.get(id)),cs=contexts.map(id=>byId.get(id));
  for(const id of values)claim(id,'value',owner,key);
  for(const id of headers)claim(id,'header',owner,key);
  for(const id of contexts)claim(id,'context',owner,JSON.stringify(contextToken(byId.get(id).raw)));
  if(!valueMatches(f.value,vs)){reject('VALUE_SOURCE_SET_NOT_EXACT',owner,all);continue;}
  if(!headerMatches(key,hs,vs)){reject('HEADER_SOURCE_ROLE_MISMATCH',owner,all);continue;}
  if(!contextMatches(f.context,cs,vs)){reject('CONTEXT_SOURCE_CONFLICT',owner,all);continue;}
  validatedEvidence.push({owner,valueIds:[...values],headerIds:[...headers],contextIds:[...contexts]});
  // Internally forward only independently checked single-source claims to frozen v2.
  // No altered fields/values are returned to the caller or written to storage.
  for(const id of all)fields['checked-'+Object.keys(fields).length]={status:'verified',value:byId.get(id).raw.trim(),sourceIds:[id]};
 }
 const payLines=[];
 for(const [index,row]of (parsed.payLines??[]).entries()){
  const owner='payline:'+index,ids=row?.sourceIds;
  if(!row||!idsOk(ids)||!ids.length){reject('INVALID_PAYLINE_SOURCE_IDS',owner,Array.isArray(ids)?ids:[]);continue;}
  const labels=ids.map(id=>byId.get(id)).filter(o=>number(o.raw)===null);
  // Legacy ledger permits one exact declared label, never arbitrary ignored text/currency.
  if(labels.length>1||labels.some(o=>typeof row.label!=='string'||o.raw.trim()!==row.label.trim())){
   reject('UNACCOUNTED_PAYLINE_TEXT',owner,ids);continue;
  }
  for(const id of ids)claim(id,number(byId.get(id).raw)===null?'header':'value',owner,'payline:'+row.code);
  payLines.push(row);
 }
 const claimed=[...claims.keys()].map(id=>byId.get(id));
 for(let i=0;i<claimed.length;i++)for(let j=i+1;j<claimed.length;j++)if(overlaps(claimed[i],claimed[j]))
  reject('OVERLAPPING_SOURCE_OBSERVATIONS','geometry',[claimed[i].id,claimed[j].id]);
 const result=auditV2(layout,{...parsed,fields,payLines});
 const warnings=new Map(result.newWarnings.map(w=>[w.sourceId,w]));
 const already=new Set(result.existingWarnings.map(w=>w.sourceId));
 for(const [id,code]of badIds)if(!already.has(id)){
  const o=byId.get(id);warnings.set(id,{code,sourceId:id,page:o.page,box:o.box??null});
 }
 const newWarnings=[...warnings.values()],allIssues=[...result.issues,...issues];
 const blocked=!result.canAutoAccept||allIssues.length>0||newWarnings.length>0;
 return {...result,status:blocked?'review-required':'candidate-ready',canAutoAccept:!blocked,canPersist:false,
  issues:allIssues,newWarnings,exemptions:result.exemptions.filter(e=>!badIds.has(e.sourceId)),
  groups:groupWarnings(newWarnings),summary:{...result.summary,newlyWarned:newWarnings.length,
   alreadyWarned:already.size,exemptions:result.exemptions.filter(e=>!badIds.has(e.sourceId)).length,
   linkedObservations:[...claims.keys()].filter(id=>!warnings.has(id)&&!already.has(id)).length},
  validatedEvidence:validatedEvidence.filter(e=>
   [...e.valueIds,...e.headerIds,...e.contextIds].every(id=>!badIds.has(id)))};
}
