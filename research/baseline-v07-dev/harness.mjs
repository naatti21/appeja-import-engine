// Measurement only. No parser modifications, no generated source documents.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as pdfjs from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import {readPdfWithPdfJs} from '../../src/layout.mjs';
import {parsePayrollSections} from '../../src/payroll-sections.mjs';
if(pdfjs.version!=='6.4.299')throw Error('Incorrect PDF.js version');

const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(process.argv[2]??'../blindtest-public');
const out=path.resolve(process.argv[3]??here);
fs.mkdirSync(path.join(out,'raw'),{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitHash=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const manifestBytes=fs.readFileSync(path.join(source,'MANIFEST.json'));
const manifest=JSON.parse(manifestBytes);
if(manifest.documents.length!==6||manifest.documents.some(x=>!x.pdf.startsWith('DEV/')||!x.annotation.startsWith('ANNOTATIONS/DEV/')))throw Error('DEV-only source required');
const integrity=[];
for(const f of manifest.files){
 const p=path.resolve(source,f.path);if(!p.startsWith(source+path.sep))throw Error('unsafe input');
 const ok=fs.existsSync(p)&&hash(fs.readFileSync(p))===f.sha256;integrity.push({path:f.path,sha256:f.sha256,match:ok});
}
const codePaths=['layout','payroll-sections','payroll-lines','acceptance','holdings','evidence','numbers','csv','payroll'];
const sourceHashes=codePaths.map(n=>{const b=fs.readFileSync(path.resolve(here,'../../src/'+n+'.mjs'));return {path:'src/'+n+'.mjs',sha256:hash(b),git_blob_sha:gitHash(b)};});
const norm=s=>String(s??'').replace(/\s+/gu,'');
function inArea(o,f,size){
 if(o.page!==f.page||!o.box)return false;
 const cx=(o.box.x0+o.box.x1)*size[0]/2,cy=(o.box.y0+o.box.y1)*size[1]/2;
 const [x0,y0,x1,y1]=f.bbox_pt;return cx>=x0-2&&cx<=x1+2&&cy>=y0-3&&cy<=y1+3;
}
function truthReader(field,layout,ann){
 const size=ann.page_sizes_pt[field.page-1];
 const items=layout.observations.filter(o=>inArea(o,field,size)).sort((a,b)=>a.box.y0-b.box.y0||a.box.x0-b.box.x0);
 const joined=items.map(x=>x.raw).join(' ');const found=norm(joined).includes(norm(field.raw));
 return {field_id:field.id,key:field.key,role:field.role,record:field.record,page:field.page,raw_expected:field.raw,
         located_raw:joined,raw_match:found,source_ids:items.map(x=>x.id),location_match:found,
         split_across_items:found&&!items.some(x=>norm(x.raw).includes(norm(field.raw)))};
}
const results=[];
for(const d of manifest.documents){
 const related=integrity.filter(x=>x.path===d.pdf||x.path===d.annotation);
 if(related.length!==2||related.some(x=>!x.match)){results.push({document_id:d.document_id,status:'BLOCKED_INTEGRITY',integrity:related});continue;}
 const bytes=fs.readFileSync(path.join(source,d.pdf));const ann=JSON.parse(fs.readFileSync(path.join(source,d.annotation)));
 const t=performance.now();
 try{
  // Exact exported baseline reader, injected pinned PDF.js. No truth goes into reader/parser.
  const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes));
  const readerMs=performance.now()-t;const t2=performance.now();
  const parsed=parsePayrollSections(layout);const semanticMs=performance.now()-t2;
  const readerMatches=ann.fields.map(f=>truthReader(f,layout,ann));
  const core=[];
  if(ann.document_type==='payroll')for(const [key,truth] of Object.entries(ann.payroll_core)){
   const f=parsed.fields[key];const gt=truth.field_ids.map(id=>ann.fields.find(x=>x.id===id));
   const val=gt[0]?.value??null;
   const correctValue=truth.state==='known'&&f.status==='verified'&&(typeof f.value==='number'?f.value===Number(val):f.value===val);
   const referenced=f.sourceIds.map(id=>layout.observations.find(x=>x.id===id)).filter(Boolean);
   const valueSource=gt.some(g=>referenced.some(o=>inArea(o,g,ann.page_sizes_pt[g.page-1])))&&readerMatches.some(r=>truth.field_ids.includes(r.field_id)&&r.raw_match);
   const labelSource=gt.some(g=>g.label_bbox_pt&&referenced.some(o=>inArea(o,{page:g.page,bbox_pt:g.label_bbox_pt},ann.page_sizes_pt[g.page-1])));
   core.push({key,expected_state:truth.state,expected_value:val,actual:f,correct_value:correctValue,
              correct_value_source:correctValue&&valueSource,correct_label_source:correctValue&&labelSource,
              exact_core_match:correctValue&&valueSource&&labelSource,
              correct_missing:truth.state==='missing'&&f.status==='missing'&&f.value===null,
              source_refs_exist:f.sourceIds.every(id=>layout.observations.some(o=>o.id===id))});
  }
  const material=parsed.observations.filter(x=>x.material).map(x=>x.id);
  const covered=new Set([...parsed.payLines.flatMap(x=>x.sourceIds),...Object.values(parsed.fields).filter(f=>f.status==='verified').flatMap(f=>f.sourceIds)]);
  const unresolved=material.filter(id=>!covered.has(id));
  const essentialUncovered=readerMatches.filter(m=>m.raw_match&&m.source_ids.every(id=>!covered.has(id)));
  const withSpecificUnknown=essentialUncovered.filter(m=>m.source_ids.some(id=>unresolved.includes(id)));
  const rawPayload={document_id:d.document_id,layout,parsed,readerMatches,core};
  const rawText=JSON.stringify(rawPayload,null,2)+'\n';fs.writeFileSync(path.join(out,'raw',d.document_id+'.json'),rawText);
  const observedCore=core.filter(c=>c.expected_state==='known');
  results.push({document_id:d.document_id,type:ann.document_type,status:'EXECUTED_NODE_REAL_PDFJS',pages:layout.pages.length,
   raw_items:layout.observations.length,raw_expected_fields:ann.fields.length,raw_fields_found:readerMatches.filter(x=>x.raw_match).length,
   raw_locations_correct:readerMatches.filter(x=>x.location_match).length,raw_missing:readerMatches.filter(x=>!x.raw_match),
   split_fields:readerMatches.filter(x=>x.split_across_items).map(x=>x.field_id),layout_issues:layout.issues,
   core,core_known_denominator:observedCore.length,core_exact_numerator:observedCore.filter(x=>x.exact_core_match).length,
   core_wrong_verified:observedCore.filter(x=>x.actual.status==='verified'&&!x.correct_value).length,
   core_missing_numerator:core.filter(x=>x.correct_missing).length,
   semantic_non_payroll:'NOT IMPLEMENTED: holdings accepts CSV, not PDF; other domain adapters absent',
   generic_structure:'NOT IMPLEMENTED: baseline outputs rows; no generic table/cell/header/continuation graph',
   recognized_paylines:ann.document_type==='payroll'?parsed.payLines.length:null,
   verified_fields:Object.entries(parsed.fields).filter(([k,v])=>v.status==='verified').map(([k,v])=>({key:k,...v})),
   material_observations:material.length,unresolved_material_observations:unresolved.length,
   essential_fully_uncovered:essentialUncovered.length,specific_unaccounted_notice:withSpecificUnknown.length,
   essential_without_candidate_or_specific_unaccounted_notice:essentialUncovered.length-withSpecificUnknown.length,
   // Accounting audit only: annotation areas never fed into engine.
   omission_audit:essentialUncovered.map(m=>({field_id:m.field_id,role:m.role,record:m.record,
       source_ids:m.source_ids,specific_unaccounted_notice:m.source_ids.some(id=>unresolved.includes(id))})),
   decision:parsed.decision,issues:parsed.issues,
   unknown_document_type_blocked:ann.document_type==='payroll'?null:parsed.decision.problems.some(p=>p.code==='UNKNOWN_DOCUMENT_TYPE'),
   dangerous_candidate_ready:parsed.decision.status==='candidate-ready'&&(ann.document_type!=='payroll'||ann.expected.review_reasons.length>0||core.some(c=>c.expected_state==='known'&&!c.exact_core_match)),
   timings:{reader_ms:readerMs,adapter_ms:semanticMs},process_memory_snapshot:process.memoryUsage(),
   raw_file:'raw/'+d.document_id+'.json',raw_sha256:hash(Buffer.from(rawText))});
 }catch(error){results.push({document_id:d.document_id,status:'BLOCKED_RUNTIME',error:String(error),stack:error.stack});}
}
const run={baseline_sha:'8f28544651a27225c1212228753fbc6c6a265c38',fixture_sha:'72520b612444994741f6d09655e8c2f08f279308',
 environment:{node:process.version,pdfjs:pdfjs.version,playwright:JSON.parse(fs.readFileSync(path.resolve(here,'../../node_modules/@playwright/test/package.json'))).version,
 chromium:'NOT RUN - pinned Chromium 143.0.7499.4/build1200 download failed (truncated ZIP / GatewayExceptionResponse)',
 node_compat:'Standard Uint8Array.toHex environment shim loaded through --import; no baseline/PDF.js files changed',
 platform:process.platform,arch:process.arch,execution:'Node; actual PDF bytes; exact standard PDF.js build and baseline exported functions'},
 input_manifest_sha256:hash(manifestBytes),input_integrity:integrity,baseline_source_hashes:sourceHashes,
 source_unchanged:true,holdout_opened_in_this_run:false,independence:'Same agent authored fixtures earlier; DEV baseline measurement is not author-independent QA',
 measured_at_utc:new Date().toISOString()};
fs.writeFileSync(path.join(out,'RUN_MANIFEST.json'),JSON.stringify(run,null,2)+'\n');
fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify({run,documents:results},null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({id:x.document_id,status:x.status,raw:`${x.raw_fields_found}/${x.raw_expected_fields}`,
 core:`${x.core_exact_numerator}/${x.core_known_denominator}`,verified:x.verified_fields?.map(f=>[f.key,f.value]),
 decision:x.decision?.status,uncovered:x.essential_fully_uncovered,unwarned:x.essential_without_candidate_or_specific_unaccounted_notice,
 paylines:x.recognized_paylines,rawMissing:x.raw_missing,error:x.error})),null,2));
