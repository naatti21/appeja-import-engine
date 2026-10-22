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
   fields:Object.fromEntries(Object.entries(row.fields||{}).filter(([k])=>fields.includes(k)))
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
