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
import {reviewFingerprint} from './review-object-integrity.mjs';
import {isCurrentPortfolioIdentityReview} from './portfolio-identity-review.mjs';
const suggestions=new WeakMap(),requests=new WeakMap();
const rejected=()=>({rows:[],issues:[{reason:'EXPLICIT_IDENTITY_REVIEW_REQUIRED'}],requiresUserApproval:true,canPersist:false});
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
  if(!clean(exchange))return null;
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
 * Names from raw visual extraction are NOT instrument identities. The only
 * accepted lookup source is preparePortfolioIdentityReview() followed by
 * an explicit per-row chooseInstrumentIdentity() user decision.
 *
 * Caller must enforce the direct user gesture in its UI; this pure function
 * cannot infer click authenticity. No market identity is auto-verified.
 */
function checkedReviewedRows(review){
  if(!isCurrentPortfolioIdentityReview(review)||review.status!=='identity-review'||
    review.canPersist!==false||review.marketIdentityVerified!==false||
    !Array.isArray(review.rows)||!Array.isArray(review.userSelections)||
    review.rows.length>LIMIT||review.userSelections.length>LIMIT)
    return {rows:[],issues:[{reason:'EXPLICIT_IDENTITY_REVIEW_REQUIRED'}]};
  const records=[],issues=[],seen=new Set();
  for(const selection of review.userSelections) {
    if(!selection||selection.assertionSource!=='explicit-user-choice'||
      typeof selection.rowId!=='string'||seen.has(selection.rowId)) {
      issues.push({reason:'INVALID_REVIEW_CHOICE'});continue;
    }
    seen.add(selection.rowId);
    const row=review.rows.find(r=>r.rowId===selection.rowId);
    const sameIds=(field)=>Array.isArray(row?.sourceIds?.[field])&&
      Array.isArray(selection.sourceIds?.[field])&&
      JSON.stringify(row.sourceIds[field])===JSON.stringify(selection.sourceIds[field]);
    if(!row||row.kind!==selection.kind||
      row.observedText!==selection.observedText||
      row.quantity!==selection.quantity||
      JSON.stringify(row.marketValue)!==JSON.stringify(selection.marketValue)||
      !['confirm-observed','correct-name','exclude-row'].includes(selection.decision)||
      !['stock','fund'].includes(selection.kind)||
      !['name','quantity','marketValue'].every(sameIds)) {
      issues.push({reason:'INVALID_REVIEW_SOURCE_BINDING'});continue;
    }
    if(selection.decision==='exclude-row') {
      if(selection.userSelectedName!==null)
        issues.push({reason:'EXCLUDED_ROW_HAS_NAME'});
      continue;
    }
    const name=clean(selection.userSelectedName);
    if((selection.decision==='confirm-observed'&&name!==row.observedText)||
      !goodToken(name,140)||name.length<2||
      !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}\s&.'()\-+/]{0,139}$/u.test(name)){
      issues.push({reason:'INVALID_REVIEWED_INSTRUMENT_NAME'});continue;
    }
    // Never derive a query from row.observedText: it may be a subgroup heading.
    const proposed={reviewRowId:row.rowId,kind:row.kind,certainty:'candidate',canPersist:false,
      marketVerification:{status:'not-verified'},
      fields:{name:{value:name,sourceIds:[...row.sourceIds.name]},
        quantity:{value:row.quantity,sourceIds:[...row.sourceIds.quantity]}}};
    if(!validSourceRow(proposed)){issues.push({reason:'INVALID_REVIEWED_ROW'});continue;}
    records.push(proposed);
  }
  return {rows:records,issues};
}
/**
 * resolver: injected async ({name}) => instrument-resolver-v1 response.
 * 'local' uses caller-owned local candidates, and 'external' additionally
 * requires explicit session consent. Raw OCR candidates cannot reach it.
 */
async function performLookup(extraction,{
  resolver=null,lookupMode='disabled',approvedExternalLookup=false,rowId=null
}={}){
  const {rows:reviewedRows,issues}=checkedReviewedRows(extraction);
  if(issues.some(x=>x.reason==='EXPLICIT_IDENTITY_REVIEW_REQUIRED'))
    return {rows:[],issues,requiresUserApproval:true,canPersist:false};
  const rows=[];
  const allowed = (lookupMode==='local'||(lookupMode==='external'&&approvedExternalLookup===true))
    && typeof resolver==='function';
  const answers=new Map();
  for(const row of reviewedRows) {
    if(rowId!==null&&row.reviewRowId!==rowId)continue;
    if(!isCurrentPortfolioIdentityReview(extraction))return rejected();
    if(!allowed){
      rows.push(none(row,'not-checked',
        lookupMode==='external'?'EXPLICIT_LOOKUP_CONSENT_REQUIRED':'LOOKUP_NOT_ENABLED'));
      continue;
    }
    const query=clean(row.fields.name.value),key=query+'|'+row.kind;
    try{
      let promise=answers.get(key);
      if(!promise){
        // Deliberate user-selected name ONLY; never shares, OCR text,
        // original image, source IDs, positions, account or balance.
        promise=Promise.resolve().then(()=>{
          if(!isCurrentPortfolioIdentityReview(extraction))throw Error("STALE_REVIEW");
          return resolver({name:query});
        });
        answers.set(key,promise);
      }
      const response=await promise;
      if(!isCurrentPortfolioIdentityReview(extraction))return rejected();
      const matches=responseListings(response,query,row.kind);
      if(!matches.length)rows.push(none(row,'unresolved','NO_EXACT_TYPE_MATCH'));
      else rows.push({...none(row,matches.length===1?'suggested':'ambiguous',
          matches.length===1?'EXACT_NAME_UNIQUE_LISTING_UNCONFIRMED':'MULTIPLE_LISTINGS'),
        matches});
    }catch {
      rows.push(none(row,'unavailable','RESOLVER_FAILED_OR_UNTRUSTED'));
    }
  }
  if(!isCurrentPortfolioIdentityReview(extraction))return rejected();
  for(const row of rows)suggestions.set(row,{review:extraction,snapshot:reviewFingerprint(row)});
  return {rows,issues,requiresUserApproval:true,canPersist:false,
    marketVerification:'no-listing-user-confirmed'};
}
/** Deduplicate repeated clicks for the same current review and injected adapter. */
export function suggestInstrumentListings(review,options={}) {
  if(!isCurrentPortfolioIdentityReview(review))return Promise.resolve(rejected());
  const key=JSON.stringify([options.lookupMode??'disabled',options.approvedExternalLookup===true,options.rowId??null]);
  const cached=requests.get(review)??[];
  const found=cached.find(x=>x.resolver===options.resolver&&x.key===key);
  if(found)return found.promise.then(result=>isCurrentPortfolioIdentityReview(review)?result:rejected());
  const promise=performLookup(review,options);
  cached.push({resolver:options.resolver,key,promise});requests.set(review,cached);
  return promise;
}
/**
 * A deliberate instrument-choice action, not a financial write. The selected
 * listing still needs explicit app-level save approval and source review.
 */
export function selectInstrumentListing(suggestion, choice){
  const record=suggestion&&suggestions.get(suggestion);
  if(!record||!isCurrentPortfolioIdentityReview(record.review)||record.snapshot===null||record.snapshot!==reviewFingerprint(suggestion)||!['suggested','ambiguous'].includes(suggestion.status)||
     !Array.isArray(suggestion.matches)||!choice||
     typeof choice.symbol!=='string'||typeof choice.exchange!=='string')
    return {status:'selection-rejected',canPersist:false};
  // Symbols are not globally unique. A user must choose the actual venue too.
  const exact=suggestion.matches.filter(m=>m.symbol===choice.symbol&&m.exchange===choice.exchange);
  if(exact.length!==1)return {status:'selection-rejected',canPersist:false};
  return {status:'user-selected-listing',selection:{...exact[0]},kind:suggestion.kind,
    sourceIds:[...suggestion.sourceIds],marketVerified:false,canPersist:false};
}
