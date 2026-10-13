import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as pdfjs from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import {readPdfWithPdfJs,rowTokens} from '../../src/layout.mjs';
import {parsePayrollSections} from '../../src/payroll-sections.mjs';
import {parsePayrollSectionsVocabulary} from './semantic-parser.mjs';
import {normalizeSemanticRow} from './vocabulary.mjs';
import {structureLayout} from './structure.mjs';
import './check-isolation.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const input=path.resolve(process.argv[2]??'../blindtest-public');
const previous=path.resolve(process.argv[3]??path.join(here,'../baseline-v07-dev'));
const output=path.resolve(process.argv[4]??here);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitHash=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const norm=s=>String(s??'').replace(/\s+/gu,'');
const json=p=>JSON.parse(fs.readFileSync(p));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
if(pdfjs.version!=='6.4.299')throw Error('PDF.js pin mismatch');
const pins=json(path.join(here,'SOURCE_PINS.json'));
const verified=[];
function verifyFile(local,entry){const bytes=fs.readFileSync(local);if(gitHash(bytes)!==entry.sha)throw Error('Git blob mismatch '+local);verified.push({path:entry.path,git_blob_sha:entry.sha,sha256:hash(bytes)});}
// Verify imported baseline modules and lockfiles, not unused modules missing in the local materialization.
const used=['layout','payroll-sections','payroll-lines','acceptance','holdings','evidence','numbers','csv','payroll'].map(x=>'src/'+x+'.mjs').concat(['package.json','package-lock.json']);
for(const f of used)verifyFile(path.join(here,'../..',f),pins.baseline.find(x=>x.path===f));
for(const name of ['RESULTS.md','RESULTS.json','FAILURE_ANALYSIS.md','REPRODUCE.md','RUN_MANIFEST.json'])verifyFile(path.join(previous,name),pins.measurement.find(x=>x.path==='research/baseline-v07-dev/'+name));
const manifest=json(path.join(input,'MANIFEST.json'));
if(manifest.documents.length!==6||manifest.documents.some(d=>!d.pdf.startsWith('DEV/')||!d.annotation.startsWith('ANNOTATIONS/DEV/')))throw Error('Only six public DEV documents allowed');
for(const f of manifest.files){
  if(!/^(DEV\/|ANNOTATIONS\/DEV\/|README\.md$|TEST_PROTOCOL\.md$|VALIDATION_REPORT\.md$)/.test(f.path))throw Error('Non DEV file denied');
  const bytes=fs.readFileSync(path.join(input,f.path));if(hash(bytes)!==f.sha256)throw Error('Manifest integrity mismatch '+f.path);
  verifyFile(path.join(input,f.path),pins.fixtures.find(x=>x.path==='research/blindtest-v1/'+f.path));
}
verifyFile(path.join(input,'MANIFEST.json'),pins.fixtures.find(x=>x.path==='research/blindtest-v1/MANIFEST.json'));
const previousResults=json(path.join(previous,'RESULTS.json'));
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
const variants={A:{structure:false,semantics:false},B:{structure:true,semantics:false},C:{structure:false,semantics:true},D:{structure:true,semantics:true}};
const docs=[];
for(const doc of manifest.documents){
 const ann=json(path.join(input,doc.annotation));
 const bytes=fs.readFileSync(path.join(input,doc.pdf));const start=performance.now();
 const rawLayout=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes));const readerMs=performance.now()-start;
 const matches=ann.fields.map(f=>readerMatch(f,rawLayout,ann));
 write(path.join(output,'raw',doc.document_id+'-reader.json'),{layout:rawLayout,reader_matches:matches,reader_ms:readerMs});
 const results={};
 for(const [name,config] of Object.entries(variants)){
  const t=performance.now();const cloned=structuredClone(rawLayout);const layout=config.structure?structureLayout(cloned):cloned;const structureMs=performance.now()-t;
  if(JSON.stringify(layout.observations)!==JSON.stringify(rawLayout.observations))throw Error('Observation mutation');
  const rowIds=layout.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds));
  const expectedIds=rawLayout.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds));
  if(JSON.stringify([...rowIds].sort())!==JSON.stringify([...expectedIds].sort()))throw Error('Row token loss/duplication');
  const t2=performance.now();const parsed=config.semantics?parsePayrollSectionsVocabulary(layout):parsePayrollSections(layout);const adapterMs=performance.now()-t2;
  const core=scoreCore(parsed,layout,ann),known=core.filter(x=>x.expected_state==='known');
  const covered=new Set([...parsed.payLines.flatMap(x=>x.sourceIds),...Object.values(parsed.fields).filter(x=>x.status==='verified').flatMap(x=>x.sourceIds)]);
  const omissions=matches.filter(m=>m.source_ids.every(id=>!covered.has(id))).map(m=>{
    const f=ann.fields.find(f=>f.id===m.field_id);
    const genericCoreNotice=core.some(c=>c.key===f.key&&c.actual.status==='missing'&&parsed.decision.problems.some(p=>p.code==='MISSING_FIELD'&&p.field===c.key));
    const localized=parsed.decision.problems.some(p=>p.code==='UNACCOUNTED_MATERIAL'&&m.source_ids.includes(p.detail));
    return {...m,generic_core_missing_notice:genericCoreNotice,localized_material_notice:localized,no_notice:!genericCoreNotice&&!localized};
  });
  const allVerified=Object.entries(parsed.fields).filter(([k,f])=>f.status==='verified');
  const transformedRows=config.semantics?layout.pages.flatMap(p=>p.rows.map(row=>{
    const original=rowTokens(layout,row).map(t=>t.raw.trim()).join(' ').replace(/\s+/g,' ').trim();
    const normalized=normalizeSemanticRow(original,layout);return {page:p.page,row_id:row.id,source_ids:row.tokenIds,original,normalized};
  })).filter(x=>x.original!==x.normalized):[];
  const raw={layout,parsed,core,transformedRows};const rawFile=`raw/${name}/${doc.document_id}.json`;write(path.join(output,rawFile),raw);
  results[name]={core,known_core_correct:known.filter(c=>c.exact_core_match).length,known_core_denominator:known.length,
   correct_missing:core.filter(c=>c.correct_missing).length,missing_truth_denominator:core.filter(c=>c.expected_state==='missing').length,
   wrong_verified_core:core.filter(c=>c.actual.status==='verified'&&!c.exact_core_match&&c.expected_state==='known').length,
   fabricated_missing:core.filter(c=>c.expected_state==='missing'&&c.actual.status==='verified').length,
   verified_fields:allVerified.map(([key,f])=>({key,...f})),recognized_paylines:ann.document_type==='payroll'?parsed.payLines.length:null,
   structure:scoreStructure(layout,ann),decision:parsed.decision,issues:parsed.issues,coverage:parsed.coverage,
   no_notice_essential:omissions.filter(m=>m.no_notice).length,annotated_essential_denominator:matches.length,omissions,
   unassigned_numeric_observations:layout.observations.filter(o=>/[\d]/.test(o.raw)&&!covered.has(o.id)).map(o=>o.id),
   dangerous_candidate_ready:parsed.decision.status==='candidate-ready'&&(ann.document_type!=='payroll'||ann.expected.review_reasons.length>0||core.some(c=>c.expected_state==='known'&&!c.exact_core_match||c.expected_state==='missing'&&c.actual.status==='verified')),
   unknown_type_blocked:ann.document_type==='payroll'?null:parsed.decision.problems.some(p=>p.code==='UNKNOWN_DOCUMENT_TYPE'),
   preserved_observations:layout.observations.length,preserved_row_tokens:rowIds.length,
   timings:{structure_ms:structureMs,adapter_ms:adapterMs},memory_snapshot:process.memoryUsage(),raw_file:rawFile,raw_sha256:hash(fs.readFileSync(path.join(output,rawFile)))};
 }
 const previousDoc=previousResults.documents.find(x=>x.document_id===doc.document_id);
 const baselineMatch=JSON.stringify(results.A.core.map(c=>({key:c.key,actual:c.actual})))===JSON.stringify(previousDoc.core.map(c=>({key:c.key,actual:c.actual})))&&JSON.stringify(results.A.decision)===JSON.stringify(previousDoc.decision)&&JSON.stringify(results.A.verified_fields)===JSON.stringify(previousDoc.verified_fields)&&rawLayout.observations.length===previousDoc.raw_items&&matches.filter(m=>m.raw_match).length===previousDoc.raw_fields_found;
 if(!baselineMatch)throw Error('YÖAJO04 baseline mismatch '+doc.document_id);
 docs.push({document_id:doc.document_id,document_type:ann.document_type,pages:rawLayout.pages.length,raw_items:rawLayout.observations.length,raw_found:matches.filter(m=>m.raw_match).length,raw_denominator:matches.length,reader_ms:readerMs,baseline_matches_04:baselineMatch,variants:results});
}
const run={baseline_sha:'8f28544651a27225c1212228753fbc6c6a265c38',measurement_sha:'1af65c9b8648dafbc8f44ec9d202884be0ace052',fixture_sha:'72520b612444994741f6d09655e8c2f08f279308',measured_at_utc:new Date().toISOString(),environment:{node:process.version,pdfjs:pdfjs.version,playwright:json(path.join(here,'../../node_modules/@playwright/test/package.json')).version,platform:process.platform,arch:process.arch,chromium:'See BROWSER_STATUS.json; Node results are not browser tests',node_compat:'Uint8Array.toHex shim via --import'},verified_files:verified,experiment_source_hashes:['harness.mjs','structure.mjs','vocabulary.mjs','semantic-parser.mjs','regressions.mjs','node-compat.mjs','check-isolation.mjs','SOURCE_PINS.json'].map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(here,name)))})),holdout_accessed:false,independence:'DEV-tuned experiment by same agent that authored fixtures; not independent generalization evidence',variants};
write(path.join(output,'RUN_MANIFEST.json'),run);write(path.join(output,'RESULTS.json'),{run,documents:docs});
for(const name of Object.keys(variants))console.log(name,JSON.stringify(docs.map(d=>({id:d.document_id,core:d.variants[name].known_core_correct+'/'+d.variants[name].known_core_denominator,wrong:d.variants[name].wrong_verified_core,structure:d.variants[name].structure.status,decision:d.variants[name].decision.status}))));
