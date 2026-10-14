import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const json=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=json(path.join(here,'RESULTS.json'));
assert.equal(results.documents.length,6);
for(const doc of results.documents){
 assert(doc.D_reproduced_exactly);assert.equal(doc.raw_found,doc.raw_denominator);
 for(const [v,o] of Object.entries(doc.variants)){
  assert.equal(sha(fs.readFileSync(path.join(here,o.raw_file))),o.raw_sha256);
  assert.equal(o.preserved_observations,doc.raw_items);assert(o.bindings.source_references_valid);
  assert.equal(o.wrong_verified_core,0);assert.equal(o.dangerous_candidate_ready,false);
  const raw=json(path.join(here,o.raw_file));assert.equal(raw.parsed.canPersist,false);
  assert.equal(raw.parsed.decision.canPersist,false);
  if(v==='E')for(const c of raw.layout.structure.cells){
   assert(['unambiguous','uncertain','conflicting','unresolved'].includes(c.status));
   assert(c.box&&c.page&&c.reason&&Array.isArray(c.record_candidate_ids));
   assert(Array.isArray(c.label_source_ids)&&Array.isArray(c.value_source_ids)&&Array.isArray(c.unit_source_ids));
  }
 }
 assert.deepEqual(doc.variants.D.decision,doc.variants.E.decision);
 for(const f of doc.failure_dispositions){assert(f.all_observations_retained);assert(f.retained_as_uncertain_cell_ids.length);}
}
const sum=(v,k)=>results.documents.reduce((s,d)=>s+d.variants[v].bindings[k],0);
assert.equal(sum('D','unambiguous_correct'),26);assert.equal(sum('D','unambiguous_denominator'),33);
assert.equal(sum('E','unambiguous_correct'),26);assert.equal(sum('E','unambiguous_denominator'),26);
assert.equal(sum('E','certain_binding_recall_numerator'),26);assert.equal(sum('E','essential_binding_denominator'),87);
for(const v of ['D','E'])assert.equal(results.documents.reduce((s,d)=>s+d.variants[v].known_core_correct,0),10);
for(const id of ['T01','T03'])assert.equal(results.documents.find(d=>d.document_id===id).variants.E.structure.record_links.filter(r=>r.all_in_single_row&&!r.mixed_foreign_record).length,2);
assert.equal(results.documents.find(d=>d.document_id==='P03').variants.E.missing_correct,1);
const original=json(path.join(here,'ORIGINAL_REGRESSION_RESULTS.json')).results;
const e=json(path.join(here,'E_REGRESSION_RESULTS.json')).results;
const adversarial=json(path.join(here,'ADVERSARIAL_RESULTS.json')).results;
assert.equal(original.length,32);assert(original.every(r=>r.pass));assert.equal(e.length,8);assert(e.every(r=>r.pass));
assert.equal(adversarial.filter(r=>r.variant==='E').length,12);assert(adversarial.filter(r=>r.variant==='E').every(r=>r.pass));
const oracle=json(path.join(here,'PREREGISTRATION.json'));assert.equal(sha(fs.readFileSync(path.join(here,oracle.oracle_file))),oracle.oracle_sha256);
let expected=fs.readFileSync(path.join(root,'research/ablation-layout-vocab-v1/regressions.mjs'),'utf8');
expected=expected.replace("import {parsePayrollSectionsVocabulary} from './semantic-parser.mjs';", "import {parsePayrollSectionsVocabulary} from '../ablation-layout-vocab-v1/semantic-parser.mjs';")
 .replace("import {structureLayout} from './structure.mjs';", "import {structureLayoutE as structureLayout} from './structure-e.mjs';")
 .replace("['A','B','C','D']", "['E']").replace("['B','D'].includes(name)", "name==='E'").replace("['C','D'].includes(name)", "name==='E'")
 .replace("research/ablation-layout-vocab-v1/REGRESSION_RESULTS.json", "research/structure-reliability-v1/E_REGRESSION_RESULTS.json");
assert.equal(fs.readFileSync(path.join(here,'e-regressions.mjs'),'utf8'),expected);
for(const f of results.run.experiment_source_hashes)assert.equal(sha(fs.readFileSync(path.join(here,f.path))),f.sha256);
const summary={status:'DEV_TARGETS_MET',documents:6,real_PDFjs_reader:true,D_exact_reproductions:'6/6',core_D:'10/11',core_E:'10/11',
 E_certain_bindings:'26/26',E_certain_recall:'26/87',E_original_raw_conserved:'201/201',old_failures_retained_uncertain:'7/7',
 original_regressions:'32/32',old_predicates_on_E:'8/8',new_E_adversarial:'12/12',T01:'2/2',T03:'2/2',
 node_only:true,browser:'NOT RUN',holdout_opened:false,production_approval:false};
fs.writeFileSync(path.join(here,'VALIDATION.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
