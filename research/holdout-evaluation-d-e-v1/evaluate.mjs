import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {readerMatch,scoreCore,scoreStructure,bindingScore,inArea} from './scoring.mjs';
const [annotations,output]=process.argv.slice(2).map(p=>path.resolve(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freeze=JSON.parse(fs.readFileSync(path.join(output,'OUTPUT_FREEZE.json'))),docs=[];
for(const entry of freeze.entries){
 const bytes=fs.readFileSync(path.join(output,entry.output));if(sha(bytes)!==entry.sha256)throw Error('Output changed');
 const {layout,parsed}=JSON.parse(bytes),ann=JSON.parse(fs.readFileSync(path.join(annotations,entry.file.replace('.pdf','.json'))));
 const matches=ann.fields.filter(f=>f.essential).map(f=>readerMatch(f,layout,ann));
 const core=scoreCore(parsed,layout,ann),bindings=bindingScore(layout,ann),structure=scoreStructure(layout,ann);
 const covered=new Set([...parsed.payLines.flatMap(x=>x.sourceIds),...Object.values(parsed.fields).filter(x=>x.status==='verified').flatMap(x=>x.sourceIds)]);
 const coverage=matches.map(m=>{const f=ann.fields.find(f=>f.id===m.field_id);const recognized=m.source_ids.length>0&&m.source_ids.some(id=>covered.has(id));
 const generic=core.some(c=>c.key===f.key&&c.actual.status==='missing'&&parsed.decision.problems.some(p=>p.code==='MISSING_FIELD'&&p.field===c.key));
 const localized=parsed.decision.problems.some(p=>p.code==='UNACCOUNTED_MATERIAL'&&m.source_ids.includes(p.detail));
 return {...m,recognized,generic_missing_notice:generic,localized_material_notice:localized,unnoticed:!recognized&&!generic&&!localized};});
 const dangerous=parsed.decision.status==='candidate-ready'&&(ann.document_type!=='payroll'||ann.expected.review_reasons.length>0||core.some(c=>c.expected_state==='known'&&!c.exact_core_match||c.expected_state==='missing'&&c.actual.status==='verified'));
 docs.push({file:entry.file,variant:entry.variant,document_type:ann.document_type,core,bindings,structure,coverage,internal_coverage:parsed.coverage,decision:parsed.decision,issues:parsed.issues,
 known_core_correct:core.filter(c=>c.expected_state==='known'&&c.exact_core_match).length,known_core_total:core.filter(c=>c.expected_state==='known').length,
 verified_core_total:core.filter(c=>c.actual.status==='verified').length,wrong_verified_core:core.filter(c=>c.actual.status==='verified'&&!c.exact_core_match).length,
 missing_total:core.filter(c=>c.expected_state==='missing').length,missing_correct:core.filter(c=>c.correct_missing).length,
 missing_to_zero:core.filter(c=>c.expected_state==='missing'&&c.actual.value===0).length,dangerous_candidate_ready:dangerous,
 unnecessary_review:ann.expected.review_reasons.length===0&&ann.document_type==='payroll'&&parsed.decision.status==='review-required',
 unknown_domain_blocked:ann.document_type!=='payroll'&&parsed.decision.problems.some(p=>p.code==='UNKNOWN_DOCUMENT_TYPE'),
 raw_found:matches.filter(m=>m.raw_match).length,raw_total:matches.length,...entry});
}
fs.writeFileSync(path.join(output,'DOCUMENT_RESULTS.json'),JSON.stringify({evaluation_at:new Date().toISOString(),freeze_sha256:sha(fs.readFileSync(path.join(output,'OUTPUT_FREEZE.json'))),documents:docs},null,2)+'\n');
const aggregates={};for(const v of ['D','E']){const ds=docs.filter(d=>d.variant===v),sum=f=>ds.reduce((s,d)=>s+f(d),0);
 aggregates[v]={documents:ds.length,core_correct:sum(d=>d.known_core_correct),core_total:sum(d=>d.known_core_total),verified_core:sum(d=>d.verified_core_total),wrong_verified_core:sum(d=>d.wrong_verified_core),
 certain_correct:sum(d=>d.bindings.unambiguous_correct),certain_total:sum(d=>d.bindings.unambiguous_denominator),certain_wrong:sum(d=>d.bindings.unambiguous_wrong),certain_unscored:sum(d=>d.bindings.unscored_unambiguous),binding_recall_total:sum(d=>d.bindings.essential_binding_denominator),
 uncertain_primary:sum(d=>d.bindings.uncertain_primary_proposals),uncertain_primary_scorable:sum(d=>d.bindings.uncertain_primary_scorable),uncertain_primary_correct:sum(d=>d.bindings.uncertain_primary_matching),column_hypotheses:sum(d=>d.bindings.column_hypotheses),column_scorable:sum(d=>d.bindings.column_scorable),column_correct:sum(d=>d.bindings.column_matching),
 records_total:sum(d=>d.structure.record_links.length),records_intact:sum(d=>d.structure.record_links.filter(r=>r.all_in_single_row&&!r.mixed_foreign_record).length),records_mixed:sum(d=>d.structure.record_links.filter(r=>r.mixed_foreign_record).length),
 essential_total:sum(d=>d.coverage.length),raw_found:sum(d=>d.raw_found),recognized:sum(d=>d.coverage.filter(m=>m.recognized).length),warned_unrecognized:sum(d=>d.coverage.filter(m=>!m.recognized&&!m.unnoticed).length),unnoticed:sum(d=>d.coverage.filter(m=>m.unnoticed).length),
 observations:sum(d=>d.raw_observations),observations_preserved:ds.every(d=>d.observations_preserved&&d.row_tokens_preserved),dangerous_ready:sum(d=>Number(d.dangerous_candidate_ready)),unnecessary_review:sum(d=>Number(d.unnecessary_review)),review_required:sum(d=>Number(d.decision.status==='review-required')),unknown_domain_blocked:sum(d=>Number(d.unknown_domain_blocked)),missing_total:sum(d=>d.missing_total),missing_correct:sum(d=>d.missing_correct),missing_to_zero:sum(d=>d.missing_to_zero),
 structure_ms:sum(d=>d.structure_ms),semantic_ms:sum(d=>d.semantic_ms),rss_samples:ds.map(d=>d.memory.rss)};
}
fs.writeFileSync(path.join(output,'AGGREGATE_RESULTS.json'),JSON.stringify(aggregates,null,2)+'\n');console.log(JSON.stringify(aggregates,null,2));
