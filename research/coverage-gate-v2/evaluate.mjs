import {createCorpus} from './corpus.mjs';
import {auditNumericCoverage} from '../coverage-gate-v1/gate.mjs';
import {auditSourceCoverage} from './gate.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function evaluate(gate,split){
 const corpus=createCorpus(split),rows=[];
 const expected=JSON.parse(readFileSync(new URL('./CORPUS_HASHES.json',import.meta.url)));
 if(createHash('sha256').update(JSON.stringify(corpus)).digest('hex')!==expected[split].sha256)throw new Error('CORPUS_HASH_MISMATCH');
 const counts={documents:0,essential:0,essentialWarned:0,nuisance:0,nuisanceWarned:0,
  contextWarned:0,essentialDocuments:0,essentialMissDocuments:0,benignDocuments:0,
  falseBlockedBenignDocuments:0,newWarnings:0,warningGroups:0,relaxedUpstream:0,canPersist:0};
 for(const c of corpus){
  const before=JSON.stringify([c.layout,c.parsed]),actual=gate(c.layout,c.parsed);
  if(before!==JSON.stringify([c.layout,c.parsed]))throw new Error('INPUT_MUTATION '+c.id);
  const warned=new Set(actual.newWarnings.map(w=>w.sourceId));
  // Old gate doesn't expose existing warnings; validate them independently against source IDs.
  const ids=new Set(c.layout.observations.map(o=>o.id));
  for(const p of c.parsed.decision.problems??[])if(p.code==='UNACCOUNTED_MATERIAL'&&p.level!=='info'&&ids.has(p.detail))warned.add(p.detail);
  const per={essential:0,essentialWarned:0,nuisance:0,nuisanceWarned:0,contextWarned:0};
  for(const [id,role]of Object.entries(c.oracle.annotations)){
   if(role==='essential'||role==='nuisance'){per[role]++;if(warned.has(id))per[role+'Warned']++;}
   if(role==='context'&&warned.has(id))per.contextWarned++;
  }
  counts.documents++;for(const k of Object.keys(per))counts[k]+=per[k];
  if(per.essential){counts.essentialDocuments++;if(per.essentialWarned<per.essential)counts.essentialMissDocuments++;}
  const originallyBlocked=c.parsed.decision.status!=='candidate-ready'||c.parsed.decision.canAutoAccept!==true;
  if(!per.essential&&!originallyBlocked){counts.benignDocuments++;if(actual.canAutoAccept!==true)counts.falseBlockedBenignDocuments++;}
  counts.relaxedUpstream+=Number(originallyBlocked&&actual.canAutoAccept===true);
  counts.canPersist+=Number(actual.canPersist!==false);
  counts.newWarnings+=actual.newWarnings.length;
  counts.warningGroups+=actual.groups?.length??actual.newWarnings.length;
  rows.push({id:c.id,seed:c.seed,family:c.family,...per,actual});
 }
 const ratio=(a,b)=>b?a/b:null;
 return {split,counts,metrics:{essentialWarningRecall:ratio(counts.essentialWarned,counts.essential),
  nuisanceFPR:ratio(counts.nuisanceWarned,counts.nuisance),
  warningPrecision:ratio(counts.essentialWarned,counts.essentialWarned+counts.nuisanceWarned),
  benignDocumentFalseBlockRate:ratio(counts.falseBlockedBenignDocuments,counts.benignDocuments)},rows};
}
export function compare(split){
 const baseline=evaluate(auditNumericCoverage,split),candidate=evaluate(auditSourceCoverage,split);
 const {counts:c,metrics:m}=candidate;
 const criteria={essentialRecall:m.essentialWarningRecall===1&&c.essentialMissDocuments===0,
  nuisanceFPR:m.nuisanceFPR<=.1&&(!baseline.metrics.nuisanceFPR||m.nuisanceFPR<=baseline.metrics.nuisanceFPR*.5),
  benignFalseBlock:m.benignDocumentFalseBlockRate<=.1,
  invariants:c.relaxedUpstream===0&&c.canPersist===0};
 return {baseline,candidate,criteria,researchThresholdsPass:Object.values(criteria).every(Boolean),productionDecision:'NO-GO'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const split=process.argv[2];if(!['dev','eval'].includes(split))throw new Error('EXPLICIT_SPLIT_REQUIRED');
 const result=compare(split),out=process.argv[3];
 if(out){mkdirSync(out,{recursive:true});writeFileSync(out+'/'+split+'-results.json',JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({split,baseline:result.baseline.counts,candidate:result.candidate.counts,
  metrics:{baseline:result.baseline.metrics,candidate:result.candidate.metrics},criteria:result.criteria,researchThresholdsPass:result.researchThresholdsPass},null,2));
 // Completeness is separate from threshold pass; advisory exit supports collecting honest failed metrics.
}
