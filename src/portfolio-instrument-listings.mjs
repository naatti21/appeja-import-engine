/**
 * Opt-in instrument/listing *suggestions* for visually extracted holdings.
 *
 * The existing Osakevahti worker returns instrument-resolver-v1 candidates.
 * Only the observed instrument name is passed to the injected lookup adapter.
 * This module does not perform HTTP requests, persist anything, alter the
 * portfolio, or assert an exchange listing is the user's actual holding.
 *
 * The value currency is the broker's *display currency*, not necessarily the
 * security's trading currency. They must NOT be compared as an identity gate.
 */
const LIMIT = 30;
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu,' ').trim();
const canonical = value => clean(value).toLocaleLowerCase('und').replace(/[.,]/g,'').replace(/\s+/gu,' ');
const TYPES = new Map([['stock',new Set(['EQUITY'])],['fund',new Set(['MUTUALFUND','ETF'])]]);
const ALLOWED_TYPES=new Set(['EQUITY','ETF','MUTUALFUND']);
const goodToken = (s,max) => typeof s==='string' && s.length>0 && s.length<=max &&
  !/[\u0000-\u001f\u007f]/u.test(s);
function safeCandidate(raw) {
  if(!raw || typeof raw!=='object'||Array.isArray(raw))return null;
  const {symbol,shortname,longname,exchange,exchange_display,quote_type,currency,exchange_name,full_exchange_name,instrument_type}=raw;
  if(!goodToken(symbol,40) || !/^[A-Za-z0-9][A-Za-z0-9.^/_=-]{0,39}$/.test(symbol) ||
     !goodToken(quote_type,25)||!ALLOWED_TYPES.has(quote_type.toUpperCase()))return null;
  const names=[shortname,longname].filter(v=>typeof v==='string'&&v.length<=150);
  if(!names.some(n=>clean(n)))return null;
  if([exchange,exchange_display,currency,exchange_name,full_exchange_name,instrument_type].some(
    s=>s!==undefined&&(typeof s!=='string'||s.length>100||/[\u0000-\u001f\u007f]/u.test(s))))return null;
  // A listing without venue information is not suitable for selecting a
  // specific instrument. One name may exist on several stock exchanges.
  if(!clean(exchange)&&!clean(exchange_name)&&!clean(full_exchange_name))return null;
  return Object.freeze({symbol,shortname:clean(shortname),longname:clean(longname),
    exchange:clean(exchange),exchangeDisplay:clean(exchange_display),
    quoteType:quote_type.toUpperCase(),currency:clean(currency).toUpperCase(),
    exchangeName:clean(exchange_name),fullExchangeName:clean(full_exchange_name)});
}
function validSourceRow(row){
  if(!row||typeof row!=='object'||!TYPES.has(row.kind)||
    row.certainty!=='candidate'||row.canPersist!==false)return false;
  const name=row.fields?.name,qty=row.fields?.quantity;
  return name&&typeof name.value==='string'&&clean(name.value).length>1&&
    clean(name.value).length<=120&&Array.isArray(name.sourceIds)&&name.sourceIds.length>0&&
    qty&&typeof qty.value==='number'&&Number.isFinite(qty.value)&&qty.value>0&&
    Array.isArray(qty.sourceIds)&&qty.sourceIds.length>0&&
    row.marketVerification?.status==='not-verified';
}
const none=(row,status,reason)=>({
  kind:row.kind,
  name:row.fields.name.value,
  sourceIds:[...row.fields.name.sourceIds],
  status,reason,matches:[],
  selectedListing:null,marketVerified:false,canPersist:false
});
function responseListings(response,name,kind){
  if(!response||response.schema_version!=='instrument-resolver-v1'||
    !Array.isArray(response.candidates)||response.candidates.length>20 ||
    (response.query!==undefined&&canonical(response.query)!==canonical(name)))
    throw new Error('UNTRUSTED_RESOLVER_RESPONSE');
  const allowed=TYPES.get(kind);
  const matching=new Map();
  for(const item of response.candidates){
    const candidate=safeCandidate(item);
    if(!candidate||!allowed.has(candidate.quoteType))continue;
    if(![candidate.longname,candidate.shortname].some(v=>canonical(v)===canonical(name)))continue;
    const k=candidate.symbol.toUpperCase()+'|'+candidate.exchange.toUpperCase()+'|'+candidate.quoteType;
    matching.set(k,candidate);
  }
  return [...matching.values()].slice(0,8);
}
/**
 * resolver: injected async ({name}) => instrument-resolver-v1 response.
 * 'local' uses a caller-owned fictional/offline lookup with no consent needed.
 * 'external' requires explicit current-session consent. This is NOT a
 * network enablement switch or provider endpoint implementation.
 */
export async function suggestInstrumentListings(extraction,{
  resolver=null,lookupMode='disabled',approvedExternalLookup=false
}={}){
  if(!extraction||extraction.canPersist!==false||
    !Array.isArray(extraction.candidates)||extraction.candidates.length>LIMIT)
    return {rows:[],issues:[{reason:'INVALID_EXTRACTION'}],canPersist:false};
  const rows=[],issues=[];
  const allowed = (lookupMode==='local'||(lookupMode==='external'&&approvedExternalLookup===true))
    && typeof resolver==='function';
  const answers=new Map();
  for(const row of extraction.candidates){
    if(!validSourceRow(row)){issues.push({reason:'INVALID_SOURCE_ROW'});continue;}
    if(!allowed){
      rows.push(none(row,'not-checked',
        lookupMode==='external'?'EXPLICIT_LOOKUP_CONSENT_REQUIRED':'LOOKUP_NOT_ENABLED'));
      continue;
    }
    const query=clean(row.fields.name.value),key=query+'|'+row.kind;
    try{
      let promise=answers.get(key);
      if(!promise){
        // Deliberately pass only a name, never shares, value, original OCR,
        // account, document, other positions, geometry or source IDs.
        promise=Promise.resolve().then(()=>resolver({name:query}));
        answers.set(key,promise);
      }
      const response=await promise;
      const matches=responseListings(response,query,row.kind);
      if(!matches.length)rows.push(none(row,'unresolved','NO_EXACT_TYPE_MATCH'));
      else rows.push({...none(row,matches.length===1?'suggested':'ambiguous',
          matches.length===1?'EXACT_NAME_UNIQUE_LISTING_UNCONFIRMED':'MULTIPLE_LISTINGS'),
        matches});
    }catch {
      rows.push(none(row,'unavailable','RESOLVER_FAILED_OR_UNTRUSTED'));
    }
  }
  return {rows,issues,requiresUserApproval:true,canPersist:false,
    marketVerification:'no-listing-user-confirmed'};
}
/**
 * A deliberate instrument-choice action, not a financial write. The selected
 * listing still needs explicit app-level save approval and source review.
 */
export function selectInstrumentListing(suggestion, symbol){
  if(!suggestion||!['suggested','ambiguous'].includes(suggestion.status)||
     !Array.isArray(suggestion.matches)||typeof symbol!=='string')
    return {status:'selection-rejected',canPersist:false};
  const exact=suggestion.matches.filter(m=>m.symbol===symbol);
  if(exact.length!==1)return {status:'selection-rejected',canPersist:false};
  return {status:'user-selected-listing',selection:{...exact[0]},kind:suggestion.kind,
    sourceIds:[...suggestion.sourceIds],marketVerified:false,canPersist:false};
}
