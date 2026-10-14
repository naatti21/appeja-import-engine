import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as pdfjs from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import {readPdfWithPdfJs} from '../../src/layout.mjs';
import {parsePayrollSectionsVocabulary} from '../ablation-layout-vocab-v1/semantic-parser.mjs';
import {structureLayout} from '../ablation-layout-vocab-v1/structure.mjs';
import '../ablation-layout-vocab-v1/check-isolation.mjs';
import {structureLayoutE} from './structure-e.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../..');
const input=path.resolve(process.argv[2]??'../blindtest-public'),output=path.resolve(process.argv[3]??here);
const json=p=>JSON.parse(fs.readFileSync(p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitHash=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');};
const norm=s=>String(s??'').replace(/\s+/gu,'');
if(pdfjs.version!=='6.4.299')throw Error('PDF.js pin mismatch');
const pins=json(path.join(here,'SOURCE_PINS.json')),verified=[];
function verify(p,entry){const b=fs.readFileSync(p);if(!entry||gitHash(b)!==entry.sha)throw Error('Source blob mismatch '+p);verified.push({path:entry.path,sha256:hash(b),git_blob_sha:entry.sha});}
const baselinePaths=['layout','payroll-sections','payroll-lines','acceptance','holdings','evidence','numbers','csv','payroll'].map(n=>'src/'+n+'.mjs').concat(['package.json','package-lock.json']);
for(const f of pins.parent_files.filter(f=>f.path.startsWith('research/ablation-layout-vocab-v1/')||baselinePaths.includes(f.path)))verify(path.join(root,f.path),f);
const immutableBefore=verified.map(x=>({...x}));
const manifest=json(path.join(input,'MANIFEST.json'));
if(manifest.documents.length!==6||manifest.documents.some(d=>!d.pdf.startsWith('DEV/')||!d.annotation.startsWith('ANNOTATIONS/DEV/')))throw Error('DEV only');
for(const f of manifest.files){
 if(!/^(DEV\/|ANNOTATIONS\/DEV\/|README\.md$|TEST_PROTOCOL\.md$|VALIDATION_REPORT\.md$)/.test(f.path))throw Error('Non-DEV path');
 const local=path.join(input,f.path);if(hash(fs.readFileSync(local))!==f.sha256)throw Error('Input manifest mismatch');
 verify(local,pins.fixture_files.find(x=>x.path==='research/blindtest-v1/'+f.path));
}
verify(path.join(input,'MANIFEST.json'),pins.fixture_files.find(x=>x.path==='research/blindtest-v1/MANIFEST.json'));
const prior=json(path.join(root,'research/ablation-layout-vocab-v1/RESULTS.json'));
function inArea(o,f,ann,label=false){
  if(!o?.box||o.page!==f.page)return false;
  const bbox=label?f.label_bbox_pt:f.bbox_pt;if(!bbox)return false;
  const [w,h]=ann.page_sizes_pt[f.page-1],cx=(o.box.x0+o.box.x1)*w/2,cy=(o.box.y0+o.box.y1)*h/2;
  return cx>=bbox[0]-2&&cx<=bbox[2]+2&&cy>=bbox[1]-3&&cy<=bbox[3]+3;
}
function readerMatch(f,layout,ann){
  const items=layout.observations.filter(o=>inArea(o,f,ann)).sort((a,b)=>a.box.y0-b.box.y0||a.box.x0-b.box.x0);
  return {field_id:f.id,role:f.role,record:f.record,raw_expected:f.raw,located_raw:items.map(x=>x.raw).join(' '),
    raw_match:norm(items.map(x=>x.raw).join(' ')).includes(norm(f.raw)),source_ids:items.map(x=>x.id),
    split_across_items:!items.some(x=>norm(x.raw).includes(norm(f.raw)))};
}
function scoreCore(parsed,layout,ann){
  if(ann.document_type!=='payroll')return [];
  return Object.entries(ann.payroll_core).map(([key,t])=>{
    const truth=t.field_ids.map(id=>ann.fields.find(f=>f.id===id));const value=truth[0]?.value??null;
    const actual=parsed.fields[key];const refs=actual.sourceIds.map(id=>layout.observations.find(o=>o.id===id));
    const val=t.state==='known'&&actual.status==='verified'&&(typeof actual.value==='number'?actual.value===Number(value):actual.value===value);
    const vs=truth.some(f=>refs.some(o=>inArea(o,f,ann)));
    const ls=truth.some(f=>refs.some(o=>inArea(o,f,ann,true)));
    return {key,expected_state:t.state,expected_value:value,actual,correct_value:val,correct_value_source:val&&vs,correct_label_source:val&&ls,
      exact_core_match:val&&vs&&ls,correct_missing:t.state==='missing'&&actual.status==='missing'&&actual.value===null,
      source_refs_exist:refs.every(Boolean)};
  });
}
function scoreStructure(layout,ann){
  const byId=new Map(layout.observations.map(o=>[o.id,o]));
  const evaluations=[];
  for(const cell of (layout.structure?.cells??[]).filter(c=>c.value_source_ids)){
    const vals=cell.value_source_ids.map(id=>byId.get(id)),labels=cell.label_source_ids.map(id=>byId.get(id));
    const relevant=ann.fields.filter(f=>f.label_bbox_pt&&vals.some(o=>inArea(o,f,ann)));
    if(!relevant.length)continue; // GT does not define this proposed cell's header association.
    const correct=relevant.some(f=>labels.some(o=>inArea(o,f,ann,true))&&norm(vals.map(o=>o.raw).join(' ')).includes(norm(f.raw)));
    evaluations.push({cell_id:cell.id,relevant_field_ids:relevant.map(f=>f.id),correct});
  }
  // Repeated-table record separation only where the fixture actually defines a row record.
  const records=[...new Set(ann.fields.map(f=>f.record).filter(x=>x!=='document'))];
  const recordLinks=records.map(record=>{
    const fields=ann.fields.filter(f=>f.record===record),ids=fields.flatMap(f=>layout.observations.filter(o=>inArea(o,f,ann)).map(o=>o.id));
    const touched=layout.pages.flatMap(p=>p.rows).filter(row=>ids.some(id=>row.tokenIds.includes(id)));
    const foreign=ann.fields.filter(f=>f.record!=='document'&&f.record!==record).flatMap(f=>layout.observations.filter(o=>inArea(o,f,ann)).map(o=>o.id));
    return {record,all_in_single_row:touched.some(row=>ids.every(id=>row.tokenIds.includes(id))),mixed_foreign_record:touched.some(row=>foreign.some(id=>row.tokenIds.includes(id)))};
  });
  return {status:layout.structure?'PARTIAL IMPLEMENTATION':'NOT IMPLEMENTED: cell graph; row audit only',pairs_scored:layout.structure?evaluations.length:null,pairs_correct:layout.structure?evaluations.filter(x=>x.correct).length:null,wrong_pairs:layout.structure?evaluations.filter(x=>!x.correct).length:null,pair_evaluations:evaluations,record_links:recordLinks};
}
const isCertain=c=>c.status==='unambiguous'||(!c.status&&['horizontal-local','vertical-local'].includes(c.method));
function bindingScore(layout,ann){
 const byId=new Map(layout.observations.map(o=>[o.id,o]));
 const primary=layout.structure.cells.filter(c=>c.value_source_ids?.length);
 const columns=layout.structure.column_header_candidates??[];
 const eligible=ann.fields.filter(f=>f.essential&&f.label_bbox_pt);
 const matches=c=>eligible.filter(f=>{
  const values=c.value_source_ids.map(id=>byId.get(id)),labels=(c.label_source_ids??[]).map(id=>byId.get(id));
  return values.length&&labels.length&&values.every(o=>inArea(o,f,ann))&&labels.every(o=>inArea(o,f,ann,true))&&norm(values.map(o=>o.raw).join(' '))===norm(f.raw);
 }).map(f=>f.id);
 const scorable=c=>c.value_source_ids.some(id=>eligible.some(f=>inArea(byId.get(id),f,ann)));
 const evaluations=primary.map(c=>({id:c.id,status:isCertain(c)?'unambiguous':c.status??'uncertain',method:c.method,scorable:scorable(c),matches:matches(c),source_ids:c.source_ids}));
 const claimed=new Set();let correct=0;
 for(const e of evaluations.filter(e=>e.status==='unambiguous'&&e.scorable)){
  const unique=e.matches.length===1&&!claimed.has(e.matches[0]);e.correct=unique;if(unique){correct++;claimed.add(e.matches[0]);}
 }
 const possible=new Set([...primary,...columns].flatMap(matches));
 const certain=primary.filter(c=>isCertain(c)&&scorable(c)).length;
 const sourceMap=layout.observations.map(o=>o.id);
 return {unambiguous_correct:correct,unambiguous_denominator:certain,unambiguous_wrong:certain-correct,unscored_unambiguous:primary.filter(c=>isCertain(c)&&!scorable(c)).length,
  uncertain_primary_scorable:primary.filter(c=>!isCertain(c)&&scorable(c)).length,uncertain_primary_matching:primary.filter(c=>!isCertain(c)&&scorable(c)&&matches(c).length===1).length,
  column_scorable:columns.filter(scorable).length,column_matching:columns.filter(c=>scorable(c)&&matches(c).length===1).length,
  certain_binding_recall_numerator:claimed.size,essential_binding_denominator:eligible.length,
  any_state_binding_recall_numerator:possible.size,
  unresolved_essential_binding_ids:eligible.filter(f=>!claimed.has(f.id)).map(f=>f.id),
  primary_proposal_count:layout.structure.cells.length,uncertain_primary_proposals:layout.structure.cells.filter(c=>!isCertain(c)).length,
  column_hypotheses:columns.length,record_proposals:layout.structure.records?.length??null,
  state_counts:Object.fromEntries(['unambiguous','uncertain','unresolved','conflicting'].map(s=>[s,layout.structure.cells.filter(c=>(isCertain(c)?'unambiguous':c.status==='unverified'?'uncertain':c.status??'unresolved')===s).length])),
  evaluations,column_evaluations:columns.map(c=>({id:c.id,status:c.status,scorable:scorable(c),matches:matches(c),source_ids:c.source_ids})),source_references_valid:[...layout.structure.cells,...columns].every(c=>c.source_ids.every(id=>sourceMap.includes(id)))};
}
const documents=[];
for(const d of manifest.documents){
 const ann=json(path.join(input,d.annotation));const start=performance.now();
 const original=await readPdfWithPdfJs(pdfjs,new Uint8Array(fs.readFileSync(path.join(input,d.pdf))));
 const reader_ms=performance.now()-start;
 const reader_matches=ann.fields.map(f=>readerMatch(f,original,ann));
 write(path.join(output,'raw',d.document_id+'-reader.json'),{layout:original,reader_matches,reader_ms});
 const variants={};
 for(const [variant,transform] of [['D',structureLayout],['E',structureLayoutE]]){
  const t=performance.now();const layout=transform(structuredClone(original));const structure_ms=performance.now()-t;
  const t2=performance.now();const parsed=parsePayrollSectionsVocabulary(layout);const adapter_ms=performance.now()-t2;
  if(JSON.stringify(original.observations)!==JSON.stringify(layout.observations))throw Error('Observation changed');
  if(JSON.stringify(original.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds)).sort())!==JSON.stringify(layout.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds)).sort()))throw Error('Row token multiset changed');
  const core=scoreCore(parsed,layout,ann),structure=scoreStructure(layout,ann),bindings=bindingScore(layout,ann);
  const raw_file=`raw/${variant}/${d.document_id}.json`;
  write(path.join(output,raw_file),{layout,parsed,core,structure,bindings});
  const known=core.filter(c=>c.expected_state==='known');
  variants[variant]={core,known_core_correct:known.filter(c=>c.exact_core_match).length,known_core_denominator:known.length,
   wrong_verified_core:core.filter(c=>c.actual.status==='verified'&&!c.exact_core_match).length,
   verified_core_denominator:core.filter(c=>c.actual.status==='verified').length,
   missing_correct:core.filter(c=>c.correct_missing).length,missing_denominator:core.filter(c=>c.expected_state==='missing').length,
   present_but_missing:known.filter(c=>c.actual.status==='missing').length,
   decision:parsed.decision,issues:parsed.issues,coverage:parsed.coverage,recognized_paylines:parsed.payLines.length,
   structure,bindings,preserved_observations:layout.observations.length,
   unknown_type_blocked:ann.document_type==='payroll'?null:parsed.decision.problems.some(p=>p.code==='UNKNOWN_DOCUMENT_TYPE'),
   dangerous_candidate_ready:parsed.decision.status==='candidate-ready'&&(ann.document_type!=='payroll'||ann.expected.review_reasons.length>0||core.some(c=>c.expected_state==='known'&&!c.exact_core_match||c.expected_state==='missing'&&c.actual.status==='verified')),
   timings:{structure_ms,adapter_ms},memory_snapshot:process.memoryUsage(),raw_file,raw_sha256:hash(fs.readFileSync(path.join(output,raw_file)))};
  if(variant==='D'){
   const oldRaw=json(path.join(root,'research/ablation-layout-vocab-v1/raw/D/'+d.document_id+'.json'));
   if(JSON.stringify(layout)!==JSON.stringify(oldRaw.layout)||JSON.stringify(parsed)!==JSON.stringify(oldRaw.parsed))throw Error('Frozen D output mismatch '+d.document_id);
  }
 }
 const eRaw=json(path.join(output,variants.E.raw_file));
 const oldFailures=variants.D.structure.pair_evaluations.filter(e=>!e.correct);
 const oldLayout=json(path.join(output,variants.D.raw_file)).layout;
 const failure_dispositions=oldFailures.map(f=>{
  const oldCell=oldLayout.structure.cells.find(c=>c.id===f.cell_id);
  const retained=eRaw.layout.structure.cells.filter(c=>!isCertain(c)&&oldCell.source_ids.every(id=>c.source_ids.includes(id)));
  return {old_cell_id:f.cell_id,original_source_ids:oldCell.source_ids,retained_as_uncertain_cell_ids:retained.map(c=>c.id),all_observations_retained:oldCell.source_ids.every(id=>eRaw.layout.observations.some(o=>o.id===id))};
 });
 documents.push({document_id:d.document_id,document_type:ann.document_type,raw_found:reader_matches.filter(m=>m.raw_match).length,raw_denominator:reader_matches.length,raw_items:original.observations.length,pages:original.pages.length,reader_ms,D_reproduced_exactly:true,variants,failure_dispositions});
}
for(const old of immutableBefore)if(hash(fs.readFileSync(path.join(root,old.path)))!==old.sha256)throw Error('Immutable source/output changed during execution '+old.path);
const run={parent_sha:pins.parent_sha,baseline_sha:pins.baseline_sha,fixture_sha:pins.fixture_sha,measured_at_utc:new Date().toISOString(),
 environment:{node:process.version,pdfjs:pdfjs.version,playwright:json(path.join(root,'node_modules/@playwright/test/package.json')).version,platform:process.platform,arch:process.arch,execution:'Real PDF.js and original reader, Node only; browser status separate'},
 verified_files:verified,original_files_unchanged_before_after:immutableBefore.length,
 experiment_source_hashes:['structure-e.mjs','harness.mjs','adversarial.mjs','ADVERSARIAL_CASES.json','PREREGISTRATION.json','SOURCE_PINS.json','e-regressions.mjs','benchmark.mjs'].map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(here,name)))})),
 holdout_accessed_in_this_task:false,independence:'Same agent authored DEV earlier; development countertests, not independent generalization validation'};
write(path.join(output,'RUN_MANIFEST.json'),run);write(path.join(output,'RESULTS.json'),{run,documents});
console.log(JSON.stringify(documents.map(d=>({id:d.document_id,results:Object.fromEntries(Object.entries(d.variants).map(([v,o])=>[v,{core:o.known_core_correct+'/'+o.known_core_denominator,correct:o.bindings.unambiguous_correct,wrong:o.bindings.unambiguous_wrong,recall:o.bindings.certain_binding_recall_numerator+'/'+o.bindings.essential_binding_denominator,uncertain:o.bindings.uncertain_primary_proposals}]))})),null,2));
