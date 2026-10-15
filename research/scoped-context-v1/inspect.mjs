/** YÖAJO 13: structural source-scoping proof only.
 * Never replaces the frozen YÖAJO 10 acceptance audit or grants acceptance.
 */
import {auditSourceCoverage as frozenSourceAudit} from '../source-evidence-v1/gate.mjs';

const DICTIONARY={
  payDate:['Payment date','Maksupäivä'],
  grossPay:['Gross pay','Brutto','Kertymä palkkakaudelta'],
  netPay:['Net pay','Netto'],
  ytdTaxableIncome:['Taxable YTD','Kertymä vuoden alusta'],
  quantity:['Quantity','Määrä','Antal'],
  buyPrice:['Buy price','Hankintahinta'],
  currentPrice:['Current price','Nykykurssi'],
  marketValue:['Market value','Nykyarvo']
};
const norm=s=>String(s).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const allHeaders=new Set(Object.values(DICTIONARY).flat().map(norm));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validBox=b=>b&&['x0','y0','x1','y1'].every(k=>finite(b[k]))&&
  b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
const centerX=o=>(o.box.x0+o.box.x1)/2;
const overlap=(a,b)=>a.page===b.page&&
  Math.min(a.box.x1,b.box.x1)>Math.max(a.box.x0,b.box.x0)&&
  Math.min(a.box.y1,b.box.y1)>Math.max(a.box.y0,b.box.y0);
const lane=(a,b)=>Math.abs(centerX(a)-centerX(b))<=.1||
  Math.min(a.box.x1,b.box.x1)>Math.max(a.box.x0,b.box.x0);
function numericValue(raw){
  const s=raw.trim().replace(/\u2212/g,'-');
  if(!/^[+-]?(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(s))return null;
  const n=Number(s.replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
  return Number.isFinite(n)?n:null;
}
function exactValue(value,raw){
  if(typeof value==='number')return Number.isFinite(value)&&numericValue(raw)===value;
  return typeof value==='string'&&value.length>0&&value===raw.trim();
}
function currency(raw){
  const m=raw.trim().match(/^Currency:\s*(EUR|USD|SEK|GBP|JPY)$/);
  return m?.[1]??null;
}
function resultFailure(code,sourceIds=[]){
  return {code,sourceIds};
}
export function inspectScopedClaims(layout,fields){
  const fallback={status:'review-required',canAutoAccept:false,canPersist:false,
    scopeSupported:false,supported:[],issues:[],frozenAudit:null};
  if(!layout||!Array.isArray(layout.observations)||!fields||
    typeof fields!=='object'||Array.isArray(fields))
    return {...fallback,issues:[resultFailure('INVALID_SCOPED_INPUT')]};
  if(!Array.isArray(layout.issues)||layout.issues.length||
    (layout.unplacedObservations!==undefined&&
      (!Array.isArray(layout.unplacedObservations)||layout.unplacedObservations.length)))
    return {...fallback,issues:[resultFailure('SOURCE_READER_HAS_ISSUES')]};
  const byId=new Map(),issues=[],supported=[],valueOwners=new Map();
  for(const o of layout.observations){
    if(!o||typeof o.id!=='string'||!o.id.trim()||byId.has(o.id)||
      typeof o.raw!=='string'||!Number.isInteger(o.page)||o.page<1||
      !validBox(o.box)){
      return {...fallback,issues:[resultFailure('INVALID_SCOPED_OBSERVATION',o?.id?[o.id]:[])]};
    }
    byId.set(o.id,o);
  }
  // Run unchanged YÖAJO 10 audit on original, not transformed or forged proxies.
  let frozenAudit;
  try {
    frozenAudit=frozenSourceAudit(layout,{fields,payLines:[],
      decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}});
  }catch{
    return {...fallback,issues:[resultFailure('FROZEN_AUDIT_ERROR')]};
  }
  const own=(ids,code)=>{
    issues.push(resultFailure(code,ids.filter(id=>byId.has(id))));
  };
  for(const [owner,field] of Object.entries(fields)){
    if(field?.status!=='verified')continue;
    const role=field.sourceRoles,mode=field.scopedRoles,semantic=field.semanticKey??owner;
    const values=role?.valueIds,headers=role?.headerIds,contexts=role?.contextIds;
    if(!role||!mode||!Array.isArray(values)||values.length!==1||
      !Array.isArray(headers)||!Array.isArray(contexts)||
      !['column','none'].includes(mode.header)||
      !['documentCurrency','none'].includes(mode.context)){
      own([], 'INVALID_SCOPED_ROLES');continue;
    }
    const ids=[...values,...headers,...contexts];
    if(ids.some(id=>typeof id!=='string'||!byId.has(id))||
      new Set(ids).size!==ids.length||
      !Array.isArray(field.sourceIds)||
      field.sourceIds.length!==ids.length||
      field.sourceIds.some(id=>!ids.includes(id))){
      own(ids,'INVALID_OR_SURPLUS_SOURCE_IDS');continue;
    }
    const v=byId.get(values[0]);
    const priorOwner=valueOwners.get(v.id);
    if(priorOwner)own([v.id],'VALUE_SOURCE_REUSED');
    valueOwners.set(v.id,owner);
    if(!exactValue(field.value,v.raw)){
      own(ids,'VALUE_SOURCE_SET_NOT_EXACT');continue;
    }
    if(ids.some(id=>id!==v.id&&overlap(v,byId.get(id)))){
      own(ids,'OVERLAPPING_SOURCE_ROLES');continue;
    }
    let headerEvidence=null,contextEvidence=null,valid=true;
    if(mode.header==='none'&&headers.length!==0){own(headers,'UNDECLARED_HEADER_SCOPE');valid=false;}
    if(mode.header==='column'){
      if(headers.length!==1){own(headers,'COLUMN_HEADER_CARDINALITY');valid=false;}
      else{
        const h=byId.get(headers[0]);
        const labelOk=DICTIONARY[semantic]?.some(x=>norm(x)===norm(h.raw))??false;
        const aligned=h.page===v.page&&h.box.y1<v.box.y0&&
          v.box.y0-h.box.y1<=.35&&lane(h,v);
        const intervening=layout.observations.filter(o=>o.id!==h.id&&o.id!==v.id&&
          o.page===v.page&&allHeaders.has(norm(o.raw))&&
          o.box.y0>=h.box.y0&&o.box.y0<v.box.y0&&lane(o,v));
        if(!labelOk||!aligned||intervening.length){
          own([h.id,v.id,...intervening.map(x=>x.id)],'COLUMN_SCOPE_UNVERIFIED');valid=false;
        }else headerEvidence={sourceId:h.id,role:'column-heading',page:h.page};
      }
    }
    if(mode.context==='none'&&contexts.length!==0){own(contexts,'UNDECLARED_CONTEXT_SCOPE');valid=false;}
    if(mode.context==='documentCurrency'){
      if(contexts.length!==1){own(contexts,'DOCUMENT_CONTEXT_CARDINALITY');valid=false;}
      else{
        const c=byId.get(contexts[0]);
        const conflicting=layout.observations.filter(o=>o.page===v.page&&
          /^Currency:/i.test(o.raw.trim()));
        const ok=c.page===v.page&&c.box.y1<=.16&&
          currency(c.raw)!==null&&
          field.context&&Object.keys(field.context).length===1&&
          field.context.currency===currency(c.raw)&&
          conflicting.length===1&&conflicting[0].id===c.id;
        if(!ok){own([c.id,v.id,...conflicting.map(o=>o.id)],'DOCUMENT_CONTEXT_UNVERIFIED');valid=false;}
        else contextEvidence={sourceId:c.id,role:'document-currency',currency:currency(c.raw),page:c.page};
      }
    }
    if(valid)supported.push({owner,semanticKey:semantic,valueSourceId:v.id,
      header:headerEvidence,context:contextEvidence,structuralOnly:true});
  }
  return {...fallback,scopeSupported:issues.length===0&&supported.length>0,
    supported:issues.length?[]:supported,issues,frozenAudit};
}
