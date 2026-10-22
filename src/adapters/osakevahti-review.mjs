/** Osakevahti domain: positions are snapshots, NEVER cash trades. */
import {createDomainReview} from './shared-review.mjs';

const fields=['name','ticker','isin','quantity','currency','account','value','nav',
  'averageAcquisitionPrice','buyPrice','assetType'];
export function createOsakevahtiReview({source,rows=[],documentRole='UNKNOWN_DOCUMENT_ROLE'}={}){
 if(!Array.isArray(rows))throw new TypeError('INVALID_HOLDINGS_ROWS');
 const allowedRole=['CURRENT_HOLDINGS_SNAPSHOT','PORTFOLIO_HOLDINGS'].includes(documentRole);
 const issues=allowedRole?[]:[{code:'UNPROVEN_HOLDINGS_DOCUMENT_ROLE'}];
 const normalized=rows.map((row,i)=>({
   id:row.id||row.rowId||'holding-'+(i+1),
   fields:{...(row.fields||{})}
 }));
 // Source semantic roles must be provided separately by the holdings parser.
 // A NAV source must NEVER be re-used as averageAcquisitionPrice or buyPrice.
 for(let i=0;i<rows.length;i++){
   const f=normalized[i].fields;
   for(const target of ['averageAcquisitionPrice','buyPrice']){
     const refs=f[target]?.sourceIds||[],nav=f.nav?.sourceIds||[];
     if(refs.some(id=>nav.includes(id))){
       f[target]={...f[target],status:'conflict'};
       issues.push({code:'NAV_COST_SOURCE_COLLISION',recordId:normalized[i].id,field:target});
     }
   }
 }
 return createDomainReview({documentType:'holdings',source,records:normalized,
   allowedFields:fields,requiredFields:['name','quantity'],issues});
}

/**
 * Map the ACTUAL two-read fund-snapshots parser contract to the shared review
 * contract. Preserve numeric precision as decimal text, original source IDs,
 * unverified identity and all parser ambiguity. No current-holding matching.
 */
export function createOsakevahtiFundSnapshotReview({source,snapshot}={}){
 if(!snapshot||snapshot.schema!=='fund-snapshot-observations-v1'||
   snapshot.canPersist!==false||snapshot.marketIdentityVerified!==false||
   !Array.isArray(snapshot.rows)||!Array.isArray(snapshot.sourceEvidence)||
   !Array.isArray(snapshot.witnessSourceEvidence)||
   source?.sourceKind!=='image-ocr-tsv')
   throw new TypeError('INVALID_FUND_SNAPSHOT_REVIEW_INPUT');
 const issues=[];
 if(snapshot.documentRole!=='CURRENT_HOLDINGS_SNAPSHOT')
   issues.push({code:'FUND_SNAPSHOT_DOCUMENT_ROLE_UNPROVEN'});
 const src=new Map((source.observations||[]).map(o=>[o.id,o.raw]));
 const mismatchedSource=snapshot.sourceEvidence.some(e=>!src.has(e.sourceId)||src.get(e.sourceId)!==e.raw);
 if(mismatchedSource)issues.push({code:'FUND_SNAPSHOT_SOURCE_MISMATCH'});
 const numeric=new Set(['quantity','value','nav','averageAcquisitionPrice']);
 const mapped=snapshot.rows.map((row,i)=>{
   if(row.canPersist!==false||row.identityStatus!=='UNVERIFIED')
     throw new TypeError('INVALID_FUND_ROW_STATE');
   const fields={};
   for(const key of ['name','quantity','value','nav','averageAcquisitionPrice','currency']){
     const f=row.fields?.[key];
     if(!f||!['observed','ambiguous','conflict','invalid','missing'].includes(f.status))
       throw new TypeError('INVALID_FUND_FIELD_STATE');
     const observed=f.status==='observed';
     let value=null,status=f.status;
     if(observed){
       if(key==='name')value=String(f.raw||'').trim();
       else if(numeric.has(key))value=typeof f.decimal==='string'&&/^\d+(?:\.\d+)?$/.test(f.decimal)?f.decimal:null;
       else if(key==='currency')value=typeof f.value==='string'?f.value:null;
       if(value===null||value===''){status='ambiguous';value=null;
         issues.push({code:'FUND_FIELD_VALUE_UNPROVEN',recordId:row.rowId,field:key});}
     }
     // Snapshot must agree with a SECOND independent OCR reading. A forged
     // parser result cannot smuggle an uncorroborated value into the review.
     if(observed&&!Array.isArray(f.witnessEvidence)){
       status='ambiguous';value=null;
       issues.push({code:'FUND_SECOND_OCR_MISSING',recordId:row.rowId,field:key});
     }else if(observed&&f.witnessEvidence.length===0){
       status='ambiguous';value=null;
       issues.push({code:'FUND_SECOND_OCR_MISSING',recordId:row.rowId,field:key});
     }
     if(mismatchedSource&&observed){status='conflict';value=null;}
     fields[key]={value,status,sourceIds:[...(f.sourceIds||[])],role:key};
   }
   return {id:row.rowId||'fund-review-'+(i+1),fields};
 });
 return createDomainReview({documentType:'holdings',source,records:mapped,
   allowedFields:fields,requiredFields:['name','quantity'],issues});
}
