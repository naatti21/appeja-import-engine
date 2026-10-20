import {buildEconomicBindings,enforceEconomicBindings} from './fund-role-binding.mjs';
/** Local, non-persistable observations of explicitly labelled current fund holdings.
 * No bank/issuer dictionary, instrument lookup, portfolio merge or OCR identity promotion.
 * Deliberately bounded to labelled cards; unsupported structures remain unresolved.
 */
const norm=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const labels={name:['rahasto','fund','fond'],quantity:['osuudet yhteensa','total units','antal andelar'],value:['arvo','value','varde'],nav:['nav'],averageAcquisitionPrice:['gav','keskikurssi','keskihankintahinta','average acquisition price','genomsnittligt anskaffningspris']};
const roleLabels=['nykyiset omistukset','current holdings','aktuella innehav'];
// Economic labels remain labels when OCR joins dates/as-of context to them.
// Unknown unit-price/period-change roles are barriers, not holdings-value aliases.
const economicLabels={value:labels.value,nav:labels.nav,averageAcquisitionPrice:labels.averageAcquisitionPrice,
 unitPrice:['osuuden hinta','yksikkohinta','unit price','share price','price','kurssi','hinta'],
 periodChange:['paivan muutos','paivamuutos','daily change','day change','tuotto','return','avkastning']};
function keyFor(raw){
 const text=norm(raw),exact=Object.keys(labels).find(k=>labels[k].includes(text));
 if(exact)return exact;
 // Match whole label phrases, never an instrument-specific string or date.
 const matches=Object.entries(economicLabels).flatMap(([key,names])=>names.flatMap(name=>{
  const at=text.indexOf(name),end=at+name.length;
  return at>=0&&(at===0||/[\s(/:]/.test(text[at-1]))&&
   (end===text.length||/[\s\d(/:]/.test(text[end]))?[{key,at,end}]:[];
 }));
 // A company/fund name containing Value or Price is not a field label.
 // Only label phrases plus numeric/date/as-of context qualify semantically.
 let remainder=text;
 for(const m of [...matches].sort((a,b)=>(b.end-b.at)-(a.end-a.at)))remainder=remainder.replace(text.slice(m.at,m.end),' ');
 remainder=remainder.replace(/\b(as of|per|on|at|date|paivays|paiva)\b/g,' ').replace(/[\d\s.,:/()%+\-]/g,'');
 if(remainder)return undefined;
 // "price" inside "average acquisition price" is not a competing label.
 const claims=[...new Set(matches.filter(m=>!matches.some(n=>n!==m&&n.at<=m.at&&n.end>=m.end&&(n.at<m.at||n.end>m.end))).map(m=>m.key))];
 return claims.length===1?claims[0]:claims.length?'ambiguousFinancialRole':undefined;
}
export function parseDisplayedDecimal(raw){
 const s=String(raw).replace(/\u00a0|\u202f/g,' ').trim();
 if(!/^(?:\d+|\d{1,3}(?: \d{3})+)(?:[,.]\d+)?$/.test(s))return null;
 // Without a locale contract, 1.234 / 1,234 may mean grouped thousands.
 if(/^[1-9]\d{0,2}[,.]\d{3}$/.test(s))return null;
 const decimal=s.replace(/ /g,'').replace(',','.');
 if(!/[1-9]/.test(decimal)||!Number.isFinite(Number(decimal)))return null;
 return {decimal,displayPrecision:decimal.includes('.')?decimal.split('.')[1].length:0,possiblyRounded:true};
}
const evidence=obs=>obs.map(o=>({sourceId:o.id,raw:o.raw,page:o.source.page,box:{...o.source.box}}));
const boxOf=obs=>({x0:Math.min(...obs.map(o=>o.source.box.x0)),y0:Math.min(...obs.map(o=>o.source.box.y0)),x1:Math.max(...obs.map(o=>o.source.box.x1)),y1:Math.max(...obs.map(o=>o.source.box.y1))});
function valid(source){
 const obs=source?.observations;
 return Array.isArray(obs)&&obs.length>0&&!source.issues?.some(i=>i.level==='blocking')&&new Set(obs.map(o=>o?.id)).size===obs.length&&obs.every(o=>{
  const b=o?.source?.box;return o?.source?.format==='image-ocr'&&typeof o.id==='string'&&o.id.length>0&&typeof o.raw==='string'&&Number.isInteger(o.source?.page)&&o.source.page>0&&b&&Object.values(b).length===4&&Object.values(b).every(Number.isFinite)&&b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
 });
}
function segments(source){
 const rows=[];
 for(const o of [...source.observations].sort((a,b)=>a.source.page-b.source.page||a.source.box.y0-b.source.box.y0||a.source.box.x0-b.source.box.x0)){
  const b=o.source.box,cy=(b.y0+b.y1)/2;
  let row=rows.find(r=>r.page===o.source.page&&Math.abs(r.cy-cy)<Math.min(r.height,b.y1-b.y0)*.55);
  if(!row){row={page:o.source.page,cy,height:b.y1-b.y0,obs:[]};rows.push(row);}row.obs.push(o);
 }
 const out=[];
 for(const row of rows){
  let group=[];
  const flush=()=>{if(group.length){out.push({raw:group.map(o=>o.raw).join(' '),obs:group,box:boxOf(group),page:row.page});group=[];}};
  for(const o of row.obs.sort((a,b)=>a.source.box.x0-b.source.box.x0)){if(group.length&&o.source.box.x0-group.at(-1).source.box.x1>.055)flush();group.push(o);}flush();
 }
 return out.sort((a,b)=>a.page-b.page||a.box.y0-b.box.y0||a.box.x0-b.box.x0);
}
const empty=(status='missing',reason=null,obs=[])=>({status,reason,raw:obs.map(o=>o.raw).join(' '),decimal:null,sourceIds:obs.map(o=>o.id),evidence:evidence(obs),witnessEvidence:[],box:obs.length?boxOf(obs):null});
function observed(obs,extra={}){return {...empty('observed',null,obs),...extra};}
function oneRead(source,detail=false){
 const lines=segments(source);
 const role=lines.filter(l=>(detail?['rahaston tiedot','fund details','fondinformation']:[...roleLabels,'rahastot']).includes(norm(l.raw)));
 if(role.length!==1||lines.some(l=>/ostokuitti|purchase receipt|kopnota|ostotapahtuma/i.test(norm(l.raw))))return {documentRole:'UNKNOWN_DOCUMENT_ROLE',rows:[],roleEvidence:[]};
 if(!detail&&norm(role[0].raw)==='rahastot')return brokerRead(lines,source,role[0]);
 const starts=lines.filter(l=>keyFor(l.raw)==='name'&&l.page===role[0].page&&l.box.y0>role[0].box.y1);
 const rows=starts.map((start,index)=>{
  const end=starts[index+1]?.box.y0??1;
  const block=lines.filter(l=>l.page===start.page&&l.box.y0>start.box.y1&&l.box.y0<end);
  const anchors=block.filter(l=>keyFor(l.raw)&&keyFor(l.raw)!=='name');
  const nameLines=block.filter(l=>l.box.y0<(anchors[0]?.box.y0??end));
  const names=nameLines.flatMap(l=>l.obs);
  const fields={name:nameLines.length>0&&nameLines.length<=2&&!names.some(o=>/\d|\.\.\.|…/.test(o.raw))?observed(names):empty('ambiguous','NAME_ROLE_OR_TRUNCATION',names)};
  Object.assign(fields,labelledFields(block,end));
  fields.currency=currencyField(fields,source);
  return {rowId:`fund-${start.page}-${index}`,fields,identityStatus:'UNVERIFIED',canPersist:false};
 });
 enforceExclusiveNumericRoles(rows);
 const scope=starts.map((start,i)=>({id:rows[i].rowId,page:start.page,start:start.box.y0,end:starts[i+1]?.box.y0??1,nameIds:rows[i].fields.name.sourceIds}));
 const graph=buildEconomicBindings(lines.filter(l=>l.page===role[0].page&&l.box.y0>role[0].box.y1),scope,keyFor);
 enforceEconomicBindings(rows,graph);
 for(const row of rows)row.fields.currency=currencyField(row.fields,source);
 return {documentRole:detail?'FUND_DETAILS':'CURRENT_HOLDINGS_SNAPSHOT',rows,roleEvidence:evidence(role[0].obs)};
}
// Currency is a derived observation and may share evidence. Financial values
// themselves must have a single owner, including across card boundaries.
function enforceExclusiveNumericRoles(rows){
 const owners=new Map();
 const names=new Map();
 for(const row of rows)for(const e of row.fields.name.evidence){const fields=names.get(e.sourceId)??new Set();fields.add(row.fields.name);names.set(e.sourceId,fields);}
 for(const fields of names.values())if(fields.size>1)for(const field of fields){field.status='ambiguous';field.reason='SOURCE_REUSED_ACROSS_CARDS';}
 for(const row of rows)for(const key of ['quantity','value','nav','averageAcquisitionPrice']){
  const field=row.fields[key];if(field.status!=='observed')continue;
  for(const e of field.evidence.filter(e=>/\d/.test(e.raw))){
   const prior=owners.get(e.sourceId)??new Set();prior.add(field);owners.set(e.sourceId,prior);
  }
 }
 for(const fields of owners.values())if(fields.size>1)for(const field of fields){field.status='ambiguous';field.reason='SOURCE_REUSED_ACROSS_FINANCIAL_FIELDS';field.decimal=null;}
}
function agrees(a,b){
 return a.status===b?.status&&norm(a.raw)===norm(b.raw)&&a.decimal===b.decimal&&a.currency===b.currency&&a.value===b.value&&(!a.box||b.box&&Math.max(...Object.keys(a.box).map(k=>Math.abs(a.box[k]-b.box[k])))<.025);
}
function extract(primary,witness,detail=false){
 const base={schema:'fund-snapshot-observations-v1',canPersist:false,candidates:[],marketIdentityVerified:false,coverage:'PARTIAL_OR_UNKNOWN',actions:[],requiresReview:true};
 if(!valid(primary)||!valid(witness))return {...base,documentRole:'UNKNOWN_DOCUMENT_ROLE',rows:[],issues:['INVALID_SOURCE_EVIDENCE']};
 const a=oneRead(primary,detail),b=oneRead(witness,detail);
 if(a.documentRole!==b.documentRole||a.documentRole!==(detail?'FUND_DETAILS':'CURRENT_HOLDINGS_SNAPSHOT')||!agrees(observed(a.roleEvidence.map(e=>primary.observations.find(o=>o.id===e.sourceId))),observed(b.roleEvidence.map(e=>witness.observations.find(o=>o.id===e.sourceId)))))return {...base,documentRole:'UNKNOWN_DOCUMENT_ROLE',rows:[],issues:['UNPROVEN_DOCUMENT_ROLE']};
 for(const row of a.rows){
  // Match by geometric region, not the list index: a missing OCR card must not shift others.
  const peers=b.rows.filter(r=>row.fields.name.box&&r.fields.name.box&&Math.abs(r.fields.name.box.y0-row.fields.name.box.y0)<.025);
  for(const [key,field] of Object.entries(row.fields)){
   const other=peers.length===1?peers[0].fields[key]:null;
   if(!other||!agrees(field,other)){field.status='ambiguous';field.reason='OCR_READINGS_DISAGREE';field.decimal=null;}
   field.witnessEvidence=other?.evidence??[];
   field.witnessLabelEvidence=other?.labelEvidence??[];
   if(field.roleBinding)field.witnessRoleBinding=other?.roleBinding??null;
  }
  row.structuralStatus=['name','quantity','value','currency'].every(k=>row.fields[k].status==='observed')?'OBSERVED_ROW_REQUIRES_IDENTITY_REVIEW':'UNRESOLVED';
  row.canRequestCostBasis=row.fields.averageAcquisitionPrice.status==='missing'&&row.structuralStatus==='OBSERVED_ROW_REQUIRES_IDENTITY_REVIEW';
 }
 return {...base,...a,sourceEvidence:evidence(primary.observations),witnessSourceEvidence:evidence(witness.observations),issues:[]};
}
/** Keep document evidence separate. No name-based cross-account matching or deletion. */
export function combineFundSnapshots(documents){
 const unique=[...new Set(documents)];
 return {documents:unique,actions:[],canPersist:false,coverage:'PARTIAL_OR_UNKNOWN',matchingStatus:'REQUIRES_ACCOUNT_AND_IDENTITY_REVIEW'};
}

export const extractFundSnapshot=(primary,witness)=>extract(primary,witness);
/** Detail price is a separate source; never automatically matched to an account or holding. */
export const extractFundCostBasisDetail=(primary,witness)=>extract(primary,witness,true);

/** Bounded source-role adapter for fictional unlabelled fund names, inline
 * units and market value / Arvo-NAV-Keskikurssi cards. Never identifies a fund.
 * An explicit Rahastot section AND matching geometry in both reads is required.
 */
function brokerRead(lines,source,role){
 const unknown={documentRole:'UNKNOWN_DOCUMENT_ROLE',rows:[],roleEvidence:[]};
 // Do not reinterpret a partially renamed legacy labelled template.
 if(lines.some(l=>keyFor(l.raw)==='name'))return unknown;
 const content=lines.filter(l=>l.page===role.page&&l.box.y0>role.box.y1);
 const unitRE=/^(.+?)\s+(kpl|pcs|st|units|andelar)$/i;
 const moneyRE=/^(.+?)\s+(EUR|USD|SEK|GBP|CHF|NOK|DKK|€)$/i;
 const units=content.filter(l=>unitRE.test(l.raw));
 if(!units.length)return unknown;
 const cards=units.map(unit=>{
  const top=unit.box.y0-Math.max(.08,(unit.box.y1-unit.box.y0)*6);
  const nameLines=content.filter(l=>l.box.y0>=top&&l.box.y0<unit.box.y0&&l.box.x1<unit.box.x0-.04&&!keyFor(l.raw)&&!/\d|%|…|\.\.\.|^tili:/i.test(l.raw));
  return {unit,nameLines,start:nameLines[0]?.box.y0??unit.box.y0};
 });
 const scope=cards.map((c,i)=>({id:`fund-${role.page}-${i}`,page:role.page,start:c.start,end:cards[i+1]?.start??1,nameIds:c.nameLines.flatMap(l=>l.obs.map(o=>o.id))}));
 const graph=buildEconomicBindings(content,scope,keyFor);
 const rows=cards.map(({unit,nameLines,start},index)=>{
  const end=cards[index+1]?.start??1;
  const block=content.filter(l=>l.box.y0>=start&&l.box.y0<end);
  const fields=labelledFields(block,end);
  const m=unit.raw.match(unitRE),number=parseDisplayedDecimal(m[1]);
  fields.quantity=number?observed(unit.obs,{...number,currency:null}):empty('ambiguous','INVALID_NUMBER_OR_ROLE',unit.obs);
  fields.name=nameLines.length>0&&nameLines.length<=2?observed(nameLines.flatMap(l=>l.obs)):empty('ambiguous','NAME_ROLE_OR_TRUNCATION',nameLines.flatMap(l=>l.obs));
  if(!block.some(l=>keyFor(l.raw)==='value')){
   // Unlabelled compact value: only the unique money line immediately above
   // total units, in the same right-hand column. Other prices stay separate.
   const prices=block.filter(l=>moneyRE.test(l.raw)&&Math.abs(l.box.x0-unit.box.x0)<.035&&l.box.y1<unit.box.y0&&unit.box.y0-l.box.y1<(unit.box.y1-unit.box.y0)*3);
   if(prices.length===1){
    const price=prices[0];
    const binding=graph.forNumber(price.obs.map(o=>o.id),scope[index].id);
    if(binding.status!=='unlabelled')fields.value={...empty('ambiguous',binding.reason??'COMPETING_ECONOMIC_ROLE',price.obs),roleBinding:binding,labelEvidence:binding.claims.flatMap(c=>c.label.observations)};
    else{const m=price.raw.match(moneyRE),n=parseDisplayedDecimal(m[1]);fields.value=n?observed(price.obs,{...n,currency:m[2]==='€'?'EUR':m[2].toUpperCase(),bindingMethod:'scoped-unlabelled-total',roleBinding:binding}):empty('ambiguous','INVALID_NUMBER_OR_ROLE',price.obs);}
   }
   else fields.value=empty(prices.length?'ambiguous':'missing','INLINE_VALUE_NOT_UNIQUE',prices.flatMap(l=>l.obs));
  }
  fields.currency=currencyField(fields,source);
  return {rowId:`fund-${role.page}-${index}`,fields,identityStatus:'UNVERIFIED',canPersist:false};
 });
 enforceExclusiveNumericRoles(rows);
 enforceEconomicBindings(rows,graph);
 for(const row of rows)row.fields.currency=currencyField(row.fields,source);
 return {documentRole:'CURRENT_HOLDINGS_SNAPSHOT',rows,roleEvidence:evidence(role.obs)};
}
function labelledFields(block,end){
 const fields={},anchors=block.filter(l=>keyFor(l.raw)&&keyFor(l.raw)!=='name');
 for(const key of ['quantity','value','nav','averageAcquisitionPrice']){
   const a=anchors.filter(l=>keyFor(l.raw)===key);
   if(a.length!==1){fields[key]=empty(a.length?'ambiguous':'missing',a.length?'DUPLICATE_FIELD_LABEL':'FIELD_NOT_VISIBLE',a.flatMap(l=>l.obs));continue;}
   const anchor=a[0];
   // Column ownership belongs to the whole card, not to a single horizontal
   // label row. Staggering a neighboring label must never widen this cell.
   const columnPeers=anchors.filter(l=>l.box.x0>anchor.box.x0+.08);
   const right=Math.min(...columnPeers.map(l=>l.box.x0),1);
   const next=block.filter(l=>l.box.y0>anchor.box.y1&&l.box.x0>=anchor.box.x0-.025&&Math.abs(l.box.x0-anchor.box.x0)<.04&&l.box.x0<right-.02&&l.box.x1<=right+.015);
   const token=next[0];
   // Only the immediately following line within two label-heights belongs to this label.
   if(!token||token.box.y0-anchor.box.y1>Math.max(.012,(anchor.box.y1-anchor.box.y0)*2)){fields[key]=empty('missing','FIELD_NOT_VISIBLE',anchor.obs);continue;}
   const re=key==='quantity'?/^(.+?)\s+(kpl|pcs|st|units|andelar)$/i:/^(.+?)\s+(EUR|USD|SEK|GBP|CHF|NOK|DKK|€)$/i;
   const lower=anchors.filter(l=>l.box.y0>anchor.box.y1&&l.box.x0>=anchor.box.x0-.025&&l.box.x0<right-.02).map(l=>l.box.y0);
   const cellEnd=Math.min(...lower,end);
   const competing=next.filter(l=>l.box.y0<cellEnd&&re.test(l.raw));
   if(competing.length>1){fields[key]=empty('ambiguous','MULTIPLE_VALUES_IN_FIELD_REGION',competing.flatMap(l=>l.obs));continue;}
   const m=token.raw.match(re),number=m&&parseDisplayedDecimal(m[1]);
   fields[key]=number?observed(token.obs,{...number,currency:key==='quantity'?null:m[2]==='€'?'EUR':m[2].toUpperCase(),labelEvidence:evidence(anchor.obs)}):empty('ambiguous','INVALID_NUMBER_OR_ROLE',token.obs);
  }
 return fields;
}
function currencyField(fields,source){
 const money=['value','nav','averageAcquisitionPrice'].map(k=>fields[k]).filter(f=>f.status==='observed');
 return money.length&&new Set(money.map(f=>f.currency)).size===1?observed(money.flatMap(f=>f.evidence.map(e=>source.observations.find(o=>o.id===e.sourceId))),{value:money[0].currency}):empty('ambiguous','CURRENCY_CONFLICT_OR_MISSING');
}
