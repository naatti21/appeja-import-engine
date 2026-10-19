/**
 * P0 #55: fail-closed handoff from visual OCR observations to identity review.
 *
 * Geometry, two OCR readings and reconciled cash do not prove that nearby text
 * is an instrument name. This boundary NEVER exports observed text as a
 * security candidate. It records a small, source-linked, per-row choice instead.
 *
 * This is research-only. A real UI must call chooseInstrumentIdentity only in
 * response to a deliberate user action. Neither function verifies a listing,
 * queries a resolver, authorizes persistence or changes the source image.
 */
const clean = x => typeof x==='string'
  ?x.normalize('NFKC').replace(/\s+/gu,' ').trim():'';
const MAX_ROWS=100;
const NAME_RE=/^[\p{L}\p{N}][\p{L}\p{N}\p{M}\s&.'()\-+/]{0,139}$/u;
const notReady = (reason,unresolved=[])=>({
  schemaVersion:1,status:'identity-review',
  rows:[],userSelections:[],candidates:[],
  unresolved:[...unresolved,{field:'name',reason,canPersist:false}],
  observedArithmetic:'not-evaluable',
  reconciliation:{status:'not-evaluable',reason:'IDENTITY_NOT_ESTABLISHED',canPersist:false},
  marketIdentityVerified:false,requiresUserApproval:true,canPersist:false
});
const idsOf = field => Array.isArray(field?.sourceIds)&&field.sourceIds.length>0&&
  field.sourceIds.every(id=>typeof id==='string'&&id.length>0)
    ?[...new Set(field.sourceIds)]:null;
function matchObservedName(sourceById,field) {
  const ids=idsOf(field);
  if(!ids)return null;
  const words=ids.map(id=>sourceById.get(id));
  if(words.some(w=>!w||typeof w.raw!=='string'||!w.source?.box))return null;
  const observed=clean(words.map(w=>w.raw).join(' '));
  if(observed!==clean(field.value))return null;
  return ids;
}
function copyUnresolved(input){
  return input.map(item=>({
    reason:clean(item?.reason)||'SOURCE_UNRESOLVED',
    field:clean(item?.field)||null,
    sourceIds:Array.isArray(item?.sourceIds)?item.sourceIds.filter(id=>typeof id==='string'):[],
    canPersist:false
  }));
}
export function preparePortfolioIdentityReview(extraction, source){
  if(!extraction||extraction.canPersist!==false||
     !Array.isArray(extraction.candidates)||
     extraction.candidates.length>MAX_ROWS||
     !Array.isArray(extraction.unresolved)||
     !source||source.canPersist!==false||
     !Array.isArray(source.observations)||source.observations.length>3000)
    return notReady('INVALID_REVIEW_SOURCE');
  const sourceById=new Map();
  for(const word of source.observations){
    if(typeof word?.id!=='string'||sourceById.has(word.id))
      return notReady('DUPLICATE_OR_INVALID_SOURCE_ID');
    sourceById.set(word.id,word);
  }
  const rows=[],unresolved=copyUnresolved(extraction.unresolved),claimed=new Set();
  for(let i=0;i<extraction.candidates.length;i++){
    const entry=extraction.candidates[i];
    const name=entry?.fields?.name,quantity=entry?.fields?.quantity;
    const market=entry?.fields?.marketValue;
    const nameIds=matchObservedName(sourceById,name);
    const qtyIds=idsOf(quantity);
    const amountIds=market?.value===null?[]:idsOf(market);
    const otherIds=[...(qtyIds??[]),...(amountIds??[])];
    const all=[...(nameIds??[]),...otherIds];
    const valid=entry.canPersist===false&&entry.certainty==='candidate'&&
      ['stock','fund'].includes(entry.kind)&&
      nameIds&&NAME_RE.test(clean(name.value))&&
      qtyIds&&qtyIds.every(id=>sourceById.has(id))&&
      typeof quantity.value==='number'&&Number.isFinite(quantity.value)&&quantity.value>0&&
      (market?.value===null||(amountIds&&amountIds.every(id=>sourceById.has(id))&&
       Number.isSafeInteger(market.value.cents)&&market.value.cents>=0&&
       /^[A-Z]{3}$/u.test(market.value.currency)))&&
      new Set(all).size===all.length&&all.every(id=>!claimed.has(id));
    if(!valid){
      unresolved.push({reason:'INVALID_IDENTITY_REVIEW_ROW',field:'name',
        sourceIds:all.filter(id=>sourceById.has(id)),canPersist:false});
      continue;
    }
    for(const id of all)claimed.add(id);
    const rowId='row-'+i+'-'+nameIds.join('.');
    rows.push({
      rowId,kind:entry.kind,status:'needs-user-identity-choice',
      observedText:clean(name.value),observedTextRole:'UNPROVEN_NAME_OR_HEADING',
      quantity:quantity.value,
      marketValue:market.value?{cents:market.value.cents,currency:market.value.currency}:null,
      sourceIds:{name:nameIds,quantity:qtyIds,marketValue:amountIds},
      marketIdentityVerified:false,canPersist:false
    });
    unresolved.push({
      reason:'UNPROVEN_SEMANTIC_NAME_ROLE',field:'name',
      reviewRowId:rowId,sourceIds:[...nameIds,...qtyIds,...amountIds],
      requiresUserApproval:true,canPersist:false
    });
  }
  const observedArithmetic=['pass','mismatch','not-evaluable'].includes(extraction.reconciliation?.status)
    ?extraction.reconciliation.status:'not-evaluable';
  return {
    schemaVersion:1,status:'identity-review',rows,userSelections:[],
    // Identity claims stay EMPTY even if the source OCR called text a candidate.
    candidates:[],unresolved,observedArithmetic,
    reconciliation:{status:'not-evaluable',reason:'IDENTITY_NOT_ESTABLISHED',canPersist:false},
    marketIdentityVerified:false,requiresUserApproval:true,canPersist:false
  };
}
/**
 * One deliberate user choice per source row. This is a recorded assertion
 * by the user, NOT market/source verification and NOT a write permit.
 * It cannot choose a row that was not part of the prepared current review.
 */
export function chooseInstrumentIdentity(review, {rowId,decision,chosenName}={}){
  if(!review||review.status!=='identity-review'||
     review.canPersist!==false||!Array.isArray(review.rows)||
     !Array.isArray(review.userSelections)||typeof rowId!=='string')
    return {status:'rejected',reason:'INVALID_REVIEW',canPersist:false};
  const row=review.rows.find(r=>r.rowId===rowId);
  if(!row||review.rows.filter(r=>r.rowId===rowId).length!==1||
     review.userSelections.some(s=>s.rowId===rowId))
    return {status:'rejected',reason:'STALE_OR_DUPLICATE_ROW',canPersist:false};
  if(!['confirm-observed','correct-name','exclude-row'].includes(decision))
    return {status:'rejected',reason:'INVALID_CHOICE',canPersist:false};
  const name=decision==='confirm-observed'?row.observedText:clean(chosenName);
  if(decision==='correct-name'&&!NAME_RE.test(name))
    return {status:'rejected',reason:'INVALID_USER_NAME',canPersist:false};
  const selected=decision==='exclude-row'?null:name;
  const choice={rowId,decision,kind:row.kind,
    observedText:row.observedText,
    userSelectedName:selected,
    quantity:row.quantity,marketValue:row.marketValue?{...row.marketValue}:null,
    sourceIds:{name:[...row.sourceIds.name],quantity:[...row.sourceIds.quantity],
      marketValue:[...row.sourceIds.marketValue]},
    assertionSource:'explicit-user-choice',marketIdentityVerified:false,canPersist:false};
  const userSelections=[...review.userSelections,choice];
  return {
    ...review,userSelections,
    status:'identity-review', // Never masquerade as automatically verified.
    // Even all reviewed rows are NOT ready to save without app-specific approval.
    candidates:[],marketIdentityVerified:false,canPersist:false,
    remainingReviewRows:review.rows.length-userSelections.length
  };
}
