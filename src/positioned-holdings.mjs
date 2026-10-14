/**
 * LAB v1.3: strict spatial holdings candidate resolver.
 * Accepts normalized PDF.js or OCR observations. No guessed columns/accounts,
 * no external quotes, no persistence, no semantically "verified" OCR fields.
 */
import {parseNumber} from './numbers.mjs';

const HEADERS=new Map(Object.entries({
 'rivi':'row_id','row':'row_id','rad':'row_id',
 'tili':'account','account':'account','konto':'account',
 'nimi':'name','name':'name','namn':'name',
 'valuutta':'currency','currency':'currency','valuta':'currency',
 'määrä':'quantity','quantity':'quantity','antal':'quantity',
 'nykykurssi':'current_price','current price':'current_price','aktuell kurs':'current_price',
 'nykyarvo':'current_value','market value':'current_value','marknadsvärde':'current_value',
 'hankintahinta':'purchase_price','purchase price':'purchase_price','inköpspris':'purchase_price'
}));
const REQUIRED=['row_id','account','name','currency','quantity','current_price','current_value','purchase_price'];
const AMOUNTS=new Set(['quantity','current_price','current_value','purchase_price']);
const MONEY=['current_price','current_value','purchase_price'];
const issue=(code,extra={})=>({code,level:'blocking',...extra});
const normalize=s=>String(s??'').trim().toLocaleLowerCase('fi-FI').replace(/\s+/g,' ');
const round=x=>Math.round(x*1000000)/1000000;
const Y_CENTER=o=>(o.source.box.y0+o.source.box.y1)/2;
const X_START=o=>o.source.box.x0;
const makeField=(field,words)=>{
 const raw=words.map(o=>o.raw).join(' ').trim();
 const sourceIds=words.map(o=>o.id);
 const base={status:'candidate',raw,value:raw,sourceIds};
 if(field==='quantity'||MONEY.includes(field)){
  const numeric=parseNumber(raw);
  return {...base,status:numeric.status==='valid'?'candidate':numeric.status,
   value:numeric.status==='valid'?numeric.value:null};
 }
 if(field==='currency'){
  const valid=/^[A-Z]{3}$/.test(raw);
  return {...base,status:valid?'candidate':'invalid',value:valid?raw:null};
 }
 if(field==='row_id'){
  const valid=/^[\p{L}\p{N}][\p{L}\p{N}_\-]{0,32}$/u.test(raw);
  return {...base,status:valid?'candidate':'invalid',value:valid?raw:null};
 }
 const valid=raw.length>0 && raw.length<180 && !/[\r\n<>]/.test(raw);
 return {...base,status:valid?'candidate':'invalid',value:valid?raw:null};
};
const cleanPage=o=>{
 const s=o?.source??{};
 const b=s.box;
 return typeof o.id==='string'&&o.id.length>0&&typeof o.raw==='string'&&
 Number.isInteger(s.page)&&s.page>0&&b&&
 [b.x0,b.x1,b.y0,b.y1].every(x=>Number.isFinite(x)&&x>=0&&x<=1)&&
 b.x1>b.x0&&b.y1>b.y0;
};
function spatialRows(words){
 const byPage=new Map();
 for(const word of words){
  const page=word.source.page;
  const pageWords=byPage.get(page)??[];
  pageWords.push(word);byPage.set(page,pageWords);
 }
 const out=[];
 for(const [page,list] of byPage){
  const sorted=[...list].sort((a,b)=>Y_CENTER(a)-Y_CENTER(b)||X_START(a)-X_START(b));
  const lines=[];
  for(const word of sorted){
   const center=Y_CENTER(word),height=word.source.box.y1-word.source.box.y0;
   const row=lines.find(r=>Math.abs(r.y-center)<=Math.max(0.003,Math.min(r.height,height)*.44));
   if(row){row.words.push(word);row.y=(row.y*(row.words.length-1)+center)/row.words.length;
    row.height=Math.max(row.height,height);}
   else lines.push({page,y:center,height,words:[word]});
  }
  out.push(...lines.map(line=>({...line,words:line.words.sort((a,b)=>X_START(a)-X_START(b))})));
 }
 return out.sort((a,b)=>a.page-b.page||a.y-b.y);
}
function recognizeHeader(words){
 const matches=[],used=new Set();
 for(let i=0;i<words.length;i++){
  if(used.has(i))continue;
  let match=null;
  for(let width=Math.min(3,words.length-i);width>=1;width--){
   if(Array.from({length:width},(_,n)=>i+n).some(n=>used.has(n)))continue;
   const span=words.slice(i,i+width),raw=span.map(o=>o.raw).join(' ');
   const key=HEADERS.get(normalize(raw));
   if(key){match={field:key,start:span[0].source.box.x0,
    end:Math.max(...span.map(w=>w.source.box.x1)),sourceIds:span.map(w=>w.id)};break;}
  }
  if(match){
   matches.push(match);
   for(let j=0;j<match.sourceIds.length;j++)used.add(i+j);
   i+=match.sourceIds.length-1;
  }
 }
 return matches;
}
function locate(words,headers){
 const columns=new Map(headers.map(h=>[h.field,[]]));
 const sorted=headers.slice().sort((a,b)=>a.start-b.start);
 const unmatched=[];
 for(const word of words){
  const x=X_START(word);
  let best=null;
  for(let i=0;i<sorted.length;i++){
   const h=sorted[i],left=i===0?-Infinity:(sorted[i-1].start+h.start)/2;
   const right=i===sorted.length-1?Infinity:(h.start+sorted[i+1].start)/2;
   if(x>=left&&x<right){best=h;break;}
  }
  if(!best||Math.abs(x-best.start)>0.071){unmatched.push(word);continue;}
  columns.get(best.field).push(word);
 }
 return {columns,unmatched};
}
export function resolvePositionedHoldings(evidence){
 const observations=evidence?.observations??[];
 const problems=[],rows=[],headerPages=[],seenIds=new Set(),seenKeys=new Map();
 if(!Array.isArray(observations))throw new TypeError('OBSERVATIONS_EXPECTED');
 for(const o of observations){
  if(seenIds.has(o?.id))problems.push(issue('DUPLICATE_SOURCE_ID',{sourceId:o.id}));
  seenIds.add(o?.id);
  if(!cleanPage(o))problems.push(issue('UNUSABLE_SOURCE_GEOMETRY',{sourceId:o?.id??null}));
 }
 if(problems.length)return {schemaVersion:1,status:'review-required',canPersist:false,
  rows:[],problems,headerPages:[],sourceCount:observations.length};
 if(!['pdf','image-ocr-tsv'].includes(evidence?.sourceKind))
  return {schemaVersion:1,status:'review-required',canPersist:false,rows:[],
   problems:[issue('UNSUPPORTED_POSITIONAL_SOURCE')],headerPages:[],sourceCount:observations.length};
 problems.push(...(evidence.issues??[]).map(i=>issue(i.code??'SOURCE_WARNING',i)));
 const lines=spatialRows(observations);
 const perPage=new Map();
 for(const line of lines){
  const match=recognizeHeader(line.words);
  if(match.length<5)continue;
  const byField=new Map();
  for(const h of match){if(byField.has(h.field))
   problems.push(issue('DUPLICATE_SEMANTIC_HEADER',{page:line.page,field:h.field}));
   else byField.set(h.field,h);}
  const missing=REQUIRED.filter(k=>!byField.has(k));
  if(missing.length)problems.push(issue('MISSING_REQUIRED_HEADER',{page:line.page,fields:missing}));
  // Reject other headers or substantial unlabeled cells (including "unmapped money").
  const matchedIds=new Set(match.flatMap(h=>h.sourceIds));
  const rest=line.words.filter(o=>!matchedIds.has(o.id));
  if(rest.length)problems.push(issue('UNKNOWN_OR_UNMAPPED_HEADER',{page:line.page,sourceIds:rest.map(o=>o.id)}));
  if(byField.size===REQUIRED.length&&missing.length===0&&!rest.length){
   const entries=[...byField.values()].sort((a,b)=>a.start-b.start);
   if(entries.some((h,i)=>i>0&&h.start-entries[i-1].start<0.032))
    problems.push(issue('COLUMN_GEOMETRY_AMBIGUOUS',{page:line.page}));
   else if(perPage.has(line.page))
    problems.push(issue('MULTIPLE_HEADER_ROWS',{page:line.page}));
   else {perPage.set(line.page,{y:line.y,entries});headerPages.push(line.page);}
  }
 }
 if(!perPage.size)problems.push(issue('NO_VERIFIABLE_TABLE_HEADER'));
 for(const line of lines){
  const head=perPage.get(line.page);
  if(!head||line.y<=head.y+Math.max(line.height,.006)*.7)continue;
  const {columns,unmatched}=locate(line.words,head.entries);
  if(unmatched.length)problems.push(issue('UNACCOUNTED_POSITIONAL_TOKEN',{
   page:line.page,sourceIds:unmatched.map(w=>w.id)}));
  const fields={};
  for(const h of head.entries){
   const tokens=columns.get(h.field)??[];
   fields[h.field]=tokens.length?makeField(h.field,tokens):
    {status:'missing',raw:'',value:null,sourceIds:[]};
  }
  const hasData=Object.values(fields).some(f=>f.sourceIds.length>0);
  if(!hasData)continue;
  const rowIssues=[];
  for(const key of REQUIRED){
   if(fields[key].status!=='candidate')
    rowIssues.push(issue('ROW_FIELD_NOT_CONFIRMED',{field:key,status:fields[key].status}));
  }
  if(fields.quantity.status==='candidate'&&fields.quantity.value<=0)
   rowIssues.push(issue('NONPOSITIVE_QUANTITY'));
  if(MONEY.some(k=>fields[k].status==='candidate'&&fields[k].value<0))
   rowIssues.push(issue('NEGATIVE_FINANCIAL_VALUE'));
  const [qty,price,value]=['quantity','current_price','current_value'].map(k=>fields[k]);
  if([qty,price,value].every(f=>f.status==='candidate')){
   if(Math.abs(qty.value*price.value-value.value)>0.055)
    rowIssues.push(issue('VALUE_PRICE_QUANTITY_CONFLICT'));
  }
  const account=fields.account.value,name=fields.name.value;
  if(account&&name){
   const key=account+'\u0000'+name;
   const existing=seenKeys.get(key);
   if(seenKeys.has(key)){
    rowIssues.push(issue('REPEATED_HOLDING_NEEDS_REVIEW',{firstRow:existing}));
   }else seenKeys.set(key,rows.length);
  }
  const row={page:line.page,y:round(line.y),fields,
   sourceIds:[...new Set(Object.values(fields).flatMap(f=>f.sourceIds))],
   problems:rowIssues,status:rowIssues.length?'review-required':'candidate-for-review'};
  if(rowIssues.length)problems.push(...rowIssues.map(p=>({...p,page:line.page,rowIndex:rows.length})));
  rows.push(row);
 }
 if(!rows.length)problems.push(issue('NO_POSITION_ROWS'));
 return {schemaVersion:1,status:'review-required',canPersist:false,rows,
  problems,headerPages,sourceCount:observations.length,
  trace:{rowCount:rows.length,candidateRows:rows.filter(r=>r.problems.length===0).length,
   unresolvedRows:rows.filter(r=>r.problems.length>0).length}};
}
