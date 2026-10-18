/**
 * Source-linked visual investment-list extractor (research adapter).
 *
 * Accepts canonical geometry from evidenceFromOcrTsv. It does not require
 * ticker/ISIN and never verifies market identity, writes holdings or learns
 * names. All values remain only in the caller's in-memory result.
 */
import {parseNumber} from './numbers.mjs';

const TYPES={osakkeet:'stock',aktier:'stock',stocks:'stock',shares:'stock',
  rahastot:'fund',fonder:'fund',funds:'fund'};
const STOPS=/^(?:säästötilit|saastotilit|savings accounts|sparkonton|accounts|tilit)$/i;
const CASH=/^(?:käytettävissä oleva saldo|kaytettavissa oleva saldo|available balance|disponibelt saldo)$/i;
const TOTAL=/^(?:arvo yhteensä|arvo yhteensa|total value|värde totalt|varde totalt)\b/i;
const EXCLUDE=/^(?:sijoitukset|sijoita|säästä ja sijoita|saasta ja sijoita|portfolio|overview|muutos|kurssi|omistus|arvonmuutos|arvonmuutos 1 päivä|arvonmuutos 1 paiva|päivän muutos|paivan muutos|suodata tuloksia|filter results|arvo yhteensä|arvo yhteensa|käytettävissä oleva saldo|kaytettavissa oleva saldo|available balance|total value|säästötilit|saastotilit|katsaus|maksa|palvelumme|tuki|more)$/i;
const moneyRegex=/(-?\d(?:[\d \u00a0\u202f]*\d)?[,.]\d{2})\s*(EUR|USD|SEK|GBP|€|\$|£)\b?/iu;
const qtyRegex=/(?:^|\s)(\d[\d., ]*)\s*(kpl|pcs|st)\b/i;
const asCurrency=s=>({€:'EUR','$':'USD','£':'GBP'})[s]??s.toUpperCase();
const strip=s=>s.normalize('NFKC').replace(/\s+/gu,' ').trim();
function parseMoney(text) {
  const m=moneyRegex.exec(strip(text));
  if(!m)return null;
  const p=parseNumber(m[1]);
  if(p.status!=='valid'||p.value<0)return null;
  const cents=Math.round(p.value*100);
  if(Math.abs(p.value*100-cents)>1e-7||!Number.isSafeInteger(cents))return null;
  return {cents,currency:asCurrency(m[2])};
}
function parseQty(text) {
  const m=qtyRegex.exec(strip(text));
  if(!m)return null;
  const p=parseNumber(m[1]);return p.status==='valid'&&p.value>0?p.value:null;
}
function validatedWords(source) {
  if(!source||!Array.isArray(source.observations)||source.observations.length>3000||
    source.issues?.some(x=>x.blocking||x.level==='blocking'))throw Error('INVALID_SOURCE');
  const ids=new Set();
  return source.observations.map(o=>{
    const b=o.source?.box;
    if(!o.id||ids.has(o.id)||typeof o.raw!=='string'||!b||
      ![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite)||
      b.x0<0||b.y0<0||b.x1>1||b.y1>1||b.x0>=b.x1||b.y0>=b.y1||
      !Number.isInteger(o.source?.page)||o.source.page<1)throw Error('INVALID_GEOMETRY');
    ids.add(o.id);
    return {id:o.id,raw:strip(o.raw),box:b,page:o.source.page,
      weak:o.source.format==='image-ocr'&&!(o.ocrConfidence>=75)};
  }).filter(w=>w.raw).sort((a,b)=>a.page-b.page||((a.box.y0+a.box.y1)-(b.box.y0+b.box.y1))||a.box.x0-b.box.x0);
}
function makeLines(words) {
  const lines=[];
  for(const w of words){
    const cy=(w.box.y0+w.box.y1)/2,h=w.box.y1-w.box.y0;
    const last=lines.at(-1);
    if(last&&last.page===w.page&&Math.abs(last.cy-cy)<=Math.max(.004,Math.min(last.h,h)*.48)){
      last.words.push(w);last.cy=(last.cy+cy)/2;last.h=Math.max(last.h,h);
    }else lines.push({page:w.page,cy,h,words:[w]});
  }
  for(const l of lines){
    l.words.sort((a,b)=>a.box.x0-b.box.x0);
    l.text=strip(l.words.map(w=>w.raw).join(' '));
    l.ids=l.words.map(w=>w.id);
    l.weak=l.words.some(w=>w.weak);
    l.left=strip(l.words.filter(w=>w.box.x0<.60).map(w=>w.raw).join(' '));
    l.right=strip(l.words.filter(w=>w.box.x0>=.60).map(w=>w.raw).join(' '));
    l.rightIds=l.words.filter(w=>w.box.x0>=.60).map(w=>w.id);
    l.leftIds=l.words.filter(w=>w.box.x0<.60).map(w=>w.id);
  }
  return lines;
}
function sourceField(value,ids) {
  return {value,status:'candidate',sourceIds:[...new Set(ids)]};
}
function findLedgerSummary(lines) {
  let total=null,cash=null,sectionOpen=false;
  for(let i=0;i<lines.length;i++){
    const l=lines[i],t=l.text;
    if(/^(?:sijoitukset|investments|investeringar)$/i.test(t))sectionOpen=true;
    if(STOPS.test(t)&&sectionOpen)break;
    const type=TOTAL.test(t)?'total':CASH.test(t)?'cash':null;
    if(!type)continue;
    const terms=[l,...lines.slice(i+1,i+3).filter(x=>
      x.page===l.page&&x.cy-l.cy<.05&&x.cy>l.cy)];
    const priced=terms.find(x=>parseMoney(x.text)&&!x.weak);
    if(!priced)continue;
    const found=parseMoney(priced.text);
    const field={...found,sourceIds:[...new Set([...l.ids,...priced.ids])]};
    if(type==='total')total=field;else cash=field;
  }
  return {total,cash};
}
function reconcile(candidates,summary,unresolved) {
  const result={status:'not-evaluable',reason:'MISSING_INDEPENDENT_TOTAL_OR_CASH',canPersist:false};
  if(!summary.total||!summary.cash)return result;
  if(summary.total.currency!==summary.cash.currency)return {...result,reason:'MIXED_CURRENCIES'};
  if(!candidates.length||unresolved.length||candidates.some(c=>!c.fields.marketValue.value))
    return {...result,reason:'INCOMPLETE_SOURCE_ROWS'};
  if(candidates.some(c=>c.fields.marketValue.value.currency!==summary.total.currency))
    return {...result,reason:'MIXED_CURRENCIES'};
  const items=candidates.reduce((sum,c)=>sum+c.fields.marketValue.value.cents,0);
  if(!Number.isSafeInteger(items))return {...result,reason:'NUMERIC_OVERFLOW'};
  const computed=items+summary.cash.cents;
  if(!Number.isSafeInteger(computed))return {...result,reason:'NUMERIC_OVERFLOW'};
  const difference=computed-summary.total.cents;
  return {status:difference===0?'pass':'mismatch',reason:difference===0?
    'VISIBLE_VALUES_MATCH':'VISIBLE_VALUES_DIFFER',currency:summary.total.currency,
    visibleHoldingsCents:items,cashCents:summary.cash.cents,
    reportedTotalCents:summary.total.cents,differenceCents:difference,
    sourceIds:[...new Set([...candidates.flatMap(c=>c.fields.marketValue.sourceIds),
      ...summary.cash.sourceIds,...summary.total.sourceIds])],
    marketIdentityVerified:false,completenessProven:false,canPersist:false};
}
/**
 * Evidence grade is always B candidate. Real market verification (C) belongs
 * to a separate privacy-reviewed resolver and explicit user approval.
 */
export function extractVisualPortfolio(source) {
  let lines;
  try{lines=makeLines(validatedWords(source));}
  catch{return {candidates:[],unresolved:[{reason:'INVALID_SOURCE'}],
    reconciliation:{status:'not-evaluable',reason:'INVALID_SOURCE'},canPersist:false};}
  const summary=findLedgerSummary(lines),candidates=[],unresolved=[];
  const boundaries=[];
  for(let i=0;i<lines.length;i++){
    const t=strip(lines[i].text).toLowerCase();
    if(Object.hasOwn(TYPES,t))boundaries.push({i,type:TYPES[t]});
    else if(STOPS.test(t))boundaries.push({i,type:null});
  }
  let active=null,boundaryIndex=-1,lastQtyCy=-Infinity;
  for(let i=0;i<lines.length;i++){
    const l=lines[i],b=boundaries.find(x=>x.i===i);
    if(b){active=b.type;boundaryIndex=i;lastQtyCy=-Infinity;continue;}
    if(!active)continue;
    // Right-hand "n kpl" is a strong visual holdings row anchor. A floating
    // amount without quantity must never become a holding.
    const right=l.words.filter(w=>w.box.x0>=.60);
    const qtext=strip(right.map(w=>w.raw).join(' '));
    const quantity=parseQty(qtext);
    if(quantity===null)continue;
    const quantityWords=right.filter(w=>qtyRegex.test(w.raw)||/\d/.test(w.raw));
    if(!quantityWords.length||right.some(w=>w.weak)){
      unresolved.push({reason:'UNCERTAIN_QUANTITY',sourceIds:l.rightIds});continue;
    }
    // Per-row right hand value is above or aligned with the quantity.
    const valueLines=lines.filter(p=>p.page===l.page&&p.cy>=l.cy-.055&&p.cy<=l.cy+.012 &&
      p.cy>lastQtyCy+.006&&p.right&&p.rightIds.length&&
      parseMoney(p.right)&&p.words.filter(w=>w.box.x0>=.60).every(w=>!w.weak));
    const amountLine=valueLines.filter(p=>!qtyRegex.test(p.right)).sort((a,b)=>Math.abs(l.cy-a.cy)-Math.abs(l.cy-b.cy))[0];
    // If amount is unavailable, a source-linked name+quantity is still a
    // reviewable candidate, but cannot be used for arithmetic.
    const start=amountLine?amountLine.cy-.014:l.cy-.035;
    const eligible=lines.filter(p=>p.page===l.page&&p.cy>=Math.max(start,lastQtyCy+.006)&&
      p.cy<=l.cy+.018&&p.left&&p.leftIds.length&&
      !EXCLUDE.test(p.left)&&!Object.hasOwn(TYPES,p.left.toLowerCase())&&
      !STOPS.test(p.left)&&!parseMoney(p.left)&&!qtyRegex.test(p.left)&&
      p.words.filter(w=>w.box.x0<.60).every(w=>!w.weak));
    const parts=eligible.slice(-3);
    const name=strip(parts.map(p=>p.left).join(' '));
    if(!name||name.length>140||parts.length>2||!/\p{L}/u.test(name)){
      unresolved.push({reason:'UNRESOLVED_INSTRUMENT_NAME',sourceIds:l.ids});lastQtyCy=l.cy;continue;
    }
    const ids=[...new Set(parts.flatMap(p=>p.leftIds))];
    const amount=amountLine?parseMoney(amountLine.right):null;
    candidates.push({kind:active,certainty:'candidate',marketVerification:{status:'not-verified'},
      fields:{name:sourceField(name,ids),quantity:sourceField(quantity,l.rightIds),
        marketValue:amount?sourceField(amount,amountLine.rightIds):{value:null,status:'missing',sourceIds:[]},
        purchasePrice:{value:null,status:'missing',sourceIds:[]}},
      canPersist:false});
    lastQtyCy=l.cy;
  }
  return {candidates,unresolved,summary,reconciliation:reconcile(candidates,summary,unresolved),
    requiresUserApproval:true,canPersist:false};
}
