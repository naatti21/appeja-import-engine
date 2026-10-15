/** YÖAJO 14: source-ID-oracle scoring against unchanged research wrappers.
 * This evaluator cannot establish parser semantic accuracy or production safety.
 */
import {createHash} from 'node:crypto';
import {newFamilyCases,expectedDesign} from './cases.mjs';
import {auditNumericCoverage} from '../coverage-gate-v1/gate.mjs';
import {auditSourceCoverage} from '../coverage-gate-v2/gate.mjs';
import {inspectScopedClaims} from '../scoped-context-v1/inspect.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const gates={'numeric-v1':auditNumericCoverage,'coverage-v2':auditSourceCoverage};
const must=(ok,msg)=>{if(!ok)throw new Error('EVALUATION_INVALID: '+msg);};
const totals=()=>({documents:0,benignDocuments:0,essentialDocuments:0,
 essential:0,essentialWarned:0,nuisance:0,nuisanceWarned:0,
 benignFalseBlocked:0,uncountedSourceIds:0,newWarnings:0,
 warningGroups:0,sourceMutations:0,unexpectedPersist:0});
function ratios(t){
 return {essentialRecall:t.essential?t.essentialWarned/t.essential:null,
  nuisanceFPR:t.nuisance?t.nuisanceWarned/t.nuisance:null,
  benignDocumentFalseBlockRate:t.benignDocuments?
   t.benignFalseBlocked/t.benignDocuments:null};
}
function runGate(cases,fn){
 const aggregate=totals(),byFamily={},details=[];
 for(const doc of cases){
  const before=hash({layout:doc.layout,parsed:doc.parsed});
  const audit=fn(doc.layout,doc.parsed);
  must(audit&&Array.isArray(audit.newWarnings),'missing warnings '+doc.id);
  const warnings=[...audit.newWarnings,...(audit.existingWarnings??[])];
  const warned=new Set();
  for(const w of warnings){
   must(typeof w.sourceId==='string','not source-specific '+doc.id);
   must(doc.annotations[w.sourceId]!==undefined,'unknown warning source '+doc.id);
   warned.add(w.sourceId);
  }
  const t=byFamily[doc.family]??(byFamily[doc.family]=totals());
  const entries=Object.entries(doc.annotations),expectedEssential=entries.filter(x=>x[1]==='essential');
  const expectedNuisance=entries.filter(x=>x[1]==='nuisance');
  must(entries.length===doc.layout.observations.length,'some observations unannotated '+doc.id);
  must(expectedEssential.length>0=== (doc.familyType==='essential'),'family/oracle mismatch '+doc.id);
  const esWarned=expectedEssential.filter(([id])=>warned.has(id)).length;
  const nuWarned=expectedNuisance.filter(([id])=>warned.has(id)).length;
  const isBenign=doc.familyType==='benign';
  // Audit only the declared coverage gate status, not app domain acceptance.
  const falseBlocked=isBenign&&(!audit.canAutoAccept||audit.status!=='candidate-ready');
  const groupCount=Array.isArray(audit.groups)?audit.groups.length:audit.newWarnings.length;
  const same=before===hash({layout:doc.layout,parsed:doc.parsed});
  const update=x=>{
   x.documents++;
   x.benignDocuments+=Number(isBenign);
   x.essentialDocuments+=Number(!isBenign);
   x.essential+=expectedEssential.length;
   x.essentialWarned+=esWarned;
   x.nuisance+=expectedNuisance.length;
   x.nuisanceWarned+=nuWarned;
   x.benignFalseBlocked+=Number(falseBlocked);
   x.newWarnings+=audit.newWarnings.length;
   x.warningGroups+=groupCount;
   x.sourceMutations+=Number(!same);
   x.unexpectedPersist+=Number(audit.canPersist!==false);
  };
  update(aggregate);update(t);
  details.push({id:doc.id,family:doc.family,benign:isBenign,
   essentialWarned:esWarned,essential:expectedEssential.length,
   nuisanceWarned:nuWarned,nuisance:expectedNuisance.length,
   falseBlocked,decision:audit.status,newWarnings:audit.newWarnings.length});
  must(same,'candidate mutates source '+doc.id);
  must(audit.canPersist===false,'candidate could persist '+doc.id);
 }
 const results={totals:aggregate,metrics:ratios(aggregate),
  byFamily:Object.fromEntries(Object.entries(byFamily).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,t])=>[k,{...t,metrics:ratios(t)}])),details};
 results.criteria={
  essentialRecall:results.metrics.essentialRecall===1,
  nuisanceFPR:results.metrics.nuisanceFPR<=.1,
  benignFalseBlocks:results.metrics.benignDocumentFalseBlockRate<=.1,
  noMutationOrPersistence:aggregate.sourceMutations===0&&aggregate.unexpectedPersist===0
 };
 results.researchThresholdsPass=Object.values(results.criteria).every(Boolean);
 return results;
}
export function evaluateNewFamilies(){
 const cases=newFamilyCases();
 must(cases.length===expectedDesign.documents,'document count');
 must(new Set(cases.map(d=>d.id)).size===cases.length,'duplicate document IDs');
 must(new Set(cases.map(d=>d.family)).size===expectedDesign.families,'family count');
 must(cases.filter(d=>d.familyType==='benign').length===expectedDesign.benignDocuments,'benign count');
 must(cases.filter(d=>d.familyType==='essential').length===expectedDesign.essentialDocuments,'essential count');
 for(const d of cases){
  const ids=d.layout.observations.map(o=>o.id);
  must(new Set(ids).size===ids.length,'duplicate source IDs '+d.id);
  must(ids.every(id=>['linked','essential','nuisance'].includes(d.annotations[id])),
    'missing/nonconforming source oracle '+d.id);
  must(Object.keys(d.annotations).length===ids.length,'annotation mismatch '+d.id);
 }
 const corpusSHA256=hash(cases);
 const variants=Object.fromEntries(Object.entries(gates).map(([id,fn])=>[id,runGate(cases,fn)]));
 // The Y13 layer is *always* review-only; it has no comparable false-block denominator.
 // An explicit empty scoped-claim input still has to refuse approval.
 const y13=inspectScopedClaims(cases[0].layout,{});
 must(y13.canPersist===false&&y13.canAutoAccept===false&&y13.status==='review-required',
   'Y13 promoted source-only review');
 return {protocol:'YÖAJO14',parentSha:'99ee1dcfa8540620e6853a18adf42b6236d6774d',
  dataset:{...expectedDesign,corpusSHA256,classification:'same-author synthetic envelopes, not independent documents'},
  variants,
  y13:{canAutoAccept:y13.canAutoAccept,canPersist:y13.canPersist,
    comparableBenignFPR:false,reason:'Y13 structural audit cannot authorize acceptance'},
  independentQA:'NOT RUN',realPdfOcrEndToEnd:'NOT RUN',productionDecision:'NO-GO'};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const obj=evaluateNewFamilies();
 console.log('Y14_SUMMARY '+JSON.stringify({dataset:obj.dataset,
  baselines:Object.fromEntries(Object.entries(obj.variants).map(([key,v])=>[key,
   {totals:v.totals,metrics:v.metrics,criteria:v.criteria,
    researchThresholdsPass:v.researchThresholdsPass}])),
  independentQA:obj.independentQA,productionDecision:obj.productionDecision}));
}
