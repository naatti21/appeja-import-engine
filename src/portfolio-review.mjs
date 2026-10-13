/**
 * v0.9 LAB: conservative post-extraction holdings-review gate.
 * Inputs are source-linked candidates, not raw OCR pixels or a screenshot parser.
 * Never authorizes persistence; no market lookups or financial inferences.
 */
import {parseNumber} from './numbers.mjs';

const issue=(code,meta={})=>({code,level:'blocking',...meta});
const kindOk=new Set(['equity','fund','other']);
function parseScalar(field,kind,refs,errors,where){
 if(!field)return null;
 if(!Array.isArray(field.sourceIds)||field.sourceIds.length===0||
    field.sourceIds.some(id=>!refs.has(id))){
  errors.push(issue('UNVERIFIABLE_SOURCE_IDS',{where}));return null;
 }
 const raw=String(field.raw??'').trim();
 const rx=kind==='quantity'
  ?/^([+\-]?[\d\s.,]+)\s*(?:kpl|shares)$/i
  :/^([+\-]?[\d\s.,]+)\s*(EUR|USD|SEK|GBP|€)$/i;
 const match=raw.match(rx);
 if(!match){errors.push(issue('INVALID_NUMBER_OR_UNIT',{where}));return null;}
 const parsed=parseNumber(match[1]);
 if(parsed.status!=='valid'||!Number.isFinite(parsed.value)){
  errors.push(issue('AMBIGUOUS_NUMBER',{where}));return null;
 }
 const currency=kind==='quantity'?null:match[2]==='€'?'EUR':match[2].toUpperCase();
 const value=parsed.value;
 if(kind==='quantity' ? value<=0 : value<0){
  errors.push(issue('INVALID_SCALAR_RANGE',{where}));return null;
 }
 return {value,currency,sourceIds:[...field.sourceIds],raw};
}
function numericEqual(a,b){return a&&b&&a.currency===b.currency&&Math.abs(a.value-b.value)<0.005;}
function samePosition(a,b){
 return numericEqual(a.quantity,b.quantity)&&numericEqual(a.marketValue,b.marketValue)&&
   (a.latestPrice===null||b.latestPrice===null||numericEqual(a.latestPrice,b.latestPrice))&&
   (a.buyPrice===null||b.buyPrice===null||numericEqual(a.buyPrice,b.buyPrice));
}
const listBy=(array,key)=>{const result=new Map();for(const x of array){const k=key(x);if(!result.has(k))result.set(k,[]);result.get(k).push(x);}return result;};

export function reviewPortfolioViews(views){
 const problems=[],positions=[],accounts=new Map();
 let duplicateViews=0,duplicatePositions=0;
 if(!Array.isArray(views)||!views.length)
  return {status:'review-required',canPersist:false,problems:[issue('NO_VIEWS')],positions:[],accounts:[]};
 const sourceIds=new Set();
 for(let vi=0;vi<views.length;vi++){
  const view=views[vi]??{},sourceId=view.sourceId;
  if(typeof sourceId!=='string'||!sourceId.trim()||sourceIds.has(sourceId)){
   problems.push(issue('INVALID_OR_DUPLICATE_VIEW_ID',{viewIndex:vi}));continue;
  }
  sourceIds.add(sourceId);
  const accountKey=view.accountKey;
  if(typeof accountKey!=='string'||!accountKey.trim()){
   problems.push(issue('ACCOUNT_NOT_VERIFIED',{sourceId}));continue;
  }
  const refIds=new Set();
  for(const o of view.observations??[]){
   if(!o||typeof o.id!=='string'||!o.id||refIds.has(o.id))problems.push(issue('INVALID_OBSERVATION_ID',{sourceId}));
   else refIds.add(o.id);
  }
  const byAccount=accounts.get(accountKey)??{accountKey,positions:new Map(),sources:[],totals:[],cash:[]};
  byAccount.sources.push(sourceId);
  accounts.set(accountKey,byAccount);
  const rows=view.holdings??[];
  if(!Array.isArray(rows)){problems.push(issue('INVALID_HOLDINGS',{sourceId}));continue;}
  let repeated=0;
  for(let ri=0;ri<rows.length;ri++){
   const h=rows[ri]??{};
   const where={sourceId,rowIndex:ri};
   if(typeof h.key!=='string'||!h.key.trim()||!kindOk.has(h.assetClass)){
    problems.push(issue('INSTRUMENT_NOT_VERIFIED',where));continue;
   }
   const qty=parseScalar(h.quantity,'quantity',refIds,problems,{...where,field:'quantity'});
   const market=parseScalar(h.marketValue,'money',refIds,problems,{...where,field:'marketValue'});
   const latest=parseScalar(h.latestPrice,'money',refIds,problems,{...where,field:'latestPrice'});
   const avg=parseScalar(h.averageCost,'money',refIds,problems,{...where,field:'averageCost'});
   // Market value, quote, tax-card amounts or fund NAV are NOT purchase cost.
   if(!qty||!market){problems.push(issue('REQUIRED_HOLDING_MISSING',where));continue;}
   if(avg&&avg.currency!==market.currency)problems.push(issue('CURRENCY_MISMATCH',where));
   if(latest&&latest.currency!==market.currency)problems.push(issue('CURRENCY_MISMATCH',where));
   if(latest){
    // Current market value can be rounded (some screenshot UIs display whole euros).
    const expected=qty.value*latest.value;
    if(Math.abs(expected-market.value)>Math.max(1.05,0.003*market.value))
     problems.push(issue('MARKET_PRICE_RECONCILIATION_FAILED',where));
   }
   const record={accountKey,key:h.key,assetClass:h.assetClass,quantity:qty,marketValue:market,
    latestPrice:latest,buyPrice:avg,sourceIds:[sourceId]};
   const existing=byAccount.positions.get(h.key);
   if(existing){
    if(existing.assetClass!==record.assetClass||!samePosition(existing,record)){
      problems.push(issue('CONFLICTING_POSITION_VIEWS',where));continue;
    }
    existing.sourceIds.push(sourceId);
    // A detail view may add a verified average cost absent from a summary.
    if(!existing.buyPrice&&record.buyPrice)existing.buyPrice=record.buyPrice;
    if(!existing.latestPrice&&record.latestPrice)existing.latestPrice=record.latestPrice;
    duplicatePositions++;repeated++;
   }else{byAccount.positions.set(h.key,record);positions.push(record);}
  }
  if(rows.length>0&&repeated===rows.length)duplicateViews++;
  const total=parseScalar(view.total,'money',refIds,problems,{sourceId,field:'total'});
  const cash=parseScalar(view.cash,'money',refIds,problems,{sourceId,field:'cash'});
  if(total)byAccount.totals.push({sourceId,...total});
  if(cash)byAccount.cash.push({sourceId,...cash});
 }
 const perAccount=[];
 for(const account of accounts.values()){
  const holdings=[...account.positions.values()];
  for(const holding of holdings)if(!holding.buyPrice)
   problems.push(issue('PURCHASE_PRICE_NOT_SHOWN',{accountKey:account.accountKey,key:holding.key}));
  const totals=account.totals,cash=account.cash;
  for(const group of [totals,cash]){
   if(group.some(v=>!numericEqual(v,group[0])))
    problems.push(issue('CONFLICTING_ACCOUNT_SUMMARY',{accountKey:account.accountKey}));
  }
  const holdingsCurrency=new Set(holdings.map(h=>h.marketValue.currency));
  if(totals.length&&cash.length&&holdings.length){
   if(holdingsCurrency.size!==1||holdingsCurrency.has(totals[0].currency)===false||
     cash[0].currency!==totals[0].currency)
    problems.push(issue('ACCOUNT_TOTAL_CURRENCY_MISMATCH',{accountKey:account.accountKey}));
   else {
    const expected=holdings.reduce((s,h)=>s+h.marketValue.value,0)+cash[0].value;
    if(Math.abs(expected-totals[0].value)>0.025)
     problems.push(issue('ACCOUNT_TOTAL_RECONCILIATION_FAILED',{accountKey:account.accountKey}));
   }
  }
  perAccount.push({accountKey:account.accountKey,positionCount:holdings.length,
   sourceCount:account.sources.length});
 }
 return {status:problems.length?'review-required':'candidate-only',
  canPersist:false,problems,positions,accounts:perAccount,duplicateViews,duplicatePositions};
}
