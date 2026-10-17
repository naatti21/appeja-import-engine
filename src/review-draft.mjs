/**
 * Engine LAB: shared, local-only review draft for app-specific import adapters.
 * A review draft is NEVER a permission to save portfolio or payroll data.
 * Keep it transient: it deliberately contains raw source observations.
 */
const STATUSES=new Set(['candidate','verified','missing','ambiguous','conflict','invalid','unverified']);
const FIELD_NAME=/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const safeValue=value=>value===null || typeof value==='string' || typeof value==='boolean' ||
  (typeof value==='number' && Number.isFinite(value));
const copy=v=>structuredClone(v);
const problem=(code,details={})=>({code,...details});

function validateSources(source){
  if(!source || source.schemaVersion!==1 || !Array.isArray(source.observations) ||
     typeof source.sourceKind!=='string')throw new TypeError('INVALID_EVIDENCE_ENVELOPE');
  const ids=new Set();
  for(const observation of source.observations){
    if(!observation || typeof observation.id!=='string' || !observation.id ||
       typeof observation.raw!=='string' || ids.has(observation.id))
      throw new TypeError('INVALID_OR_DUPLICATE_OBSERVATION');
    ids.add(observation.id);
  }
  return ids;
}

/**
 * records: [{id, fields:{ key:{value,status,sourceIds},... }}]
 * Source comes from the generic evidenceFrom*() layer. No domain interpretation.
 */
export function createReviewDraft({documentType,source,records=[],adapterProblems=[]}){
  const ids=validateSources(source);
  if(typeof documentType!=='string' || !documentType.trim() || !Array.isArray(records) ||
     !Array.isArray(adapterProblems))throw new TypeError('INVALID_REVIEW_INPUT');
  const recordIds=new Set();
  const problems=[...(source.issues||[]).map(x=>copy(x)),...adapterProblems.map(x=>copy(x))];
  const out=[];
  for(const item of records){
    if(!item || typeof item.id!=='string' || !item.id || recordIds.has(item.id) ||
       !item.fields || typeof item.fields!=='object' || Array.isArray(item.fields))
      throw new TypeError('INVALID_OR_DUPLICATE_REVIEW_RECORD');
    recordIds.add(item.id);
    const fields=Object.create(null);
    for(const [name,f] of Object.entries(item.fields)){
      if(!FIELD_NAME.test(name) || !f || typeof f!=='object' || !STATUSES.has(f.status) ||
         !safeValue(f.value) || !Array.isArray(f.sourceIds))throw new TypeError('INVALID_REVIEW_FIELD');
      const sourceIds=[];
      for(const id of f.sourceIds){
        if(typeof id!=='string' || !ids.has(id))
          problems.push(problem('BAD_SOURCE_REFERENCE',{recordId:item.id,field:name}));
        else if(sourceIds.includes(id))
          problems.push(problem('DUPLICATE_FIELD_SOURCE',{recordId:item.id,field:name}));
        else sourceIds.push(id);
      }
      if((f.status==='verified'||f.status==='candidate') && !sourceIds.length)
        problems.push(problem('MISSING_FIELD_PROVENANCE',{recordId:item.id,field:name}));
      if(f.status==='missing' && f.value!==null)
        problems.push(problem('INCONSISTENT_MISSING_VALUE',{recordId:item.id,field:name}));
      fields[name]={value:f.value,status:f.status,sourceIds,reviewState:'untouched'};
    }
    out.push({id:item.id,fields});
  }
  if(!out.length)problems.push(problem('NO_REVIEW_RECORDS'));
  return {schemaVersion:1,documentType,sourceKind:source.sourceKind,
    source:copy(source),records:out,problems,
    status:'review-required',canPersist:false,ephemeral:true};
}

/** Present just the exact raw observations underlying one field in the UI. */
export function reviewFieldSources(draft,recordId,fieldName){
  const field=draft?.records?.find(r=>r.id===recordId)?.fields?.[fieldName];
  if(!field)throw new TypeError('UNKNOWN_REVIEW_FIELD');
  const byId=new Map(draft.source.observations.map(o=>[o.id,o]));
  return field.sourceIds.map(id=>copy(byId.get(id))).filter(Boolean);
}

/** Explicit user correction; neither changes source evidence nor authorizes persistence. */
export function correctReviewField(draft,{recordId,fieldName,value,confirmed}={}){
  if(confirmed!==true)throw new TypeError('EXPLICIT_USER_CONFIRMATION_REQUIRED');
  if(!safeValue(value))throw new TypeError('INVALID_CORRECTION_VALUE');
  const next=copy(draft);
  const field=next.records?.find(r=>r.id===recordId)?.fields?.[fieldName];
  if(!field)throw new TypeError('UNKNOWN_REVIEW_FIELD');
  if(!Object.hasOwn(field,'suggestedValue'))field.suggestedValue=field.value;
  field.value=value;
  field.reviewState='user-corrected';
  next.status='review-required';next.canPersist=false;next.ephemeral=true;
  return next;
}

/** Non-sensitive diagnostic counters only; no source raw/value/identifiers. */
export function reviewDiagnostics(draft){
  if(!draft || draft.status!=='review-required')throw new TypeError('INVALID_REVIEW_DRAFT');
  const fields=draft.records.flatMap(r=>Object.values(r.fields));
  return {recordCount:draft.records.length,fieldCount:fields.length,
    correctedCount:fields.filter(f=>f.reviewState==='user-corrected').length,
    problemCount:draft.problems.length,canPersist:false};
}
