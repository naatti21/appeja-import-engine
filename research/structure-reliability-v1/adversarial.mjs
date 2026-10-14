import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {rowsFromObservations} from '../../src/layout.mjs';
import {structureLayout} from '../ablation-layout-vocab-v1/structure.mjs';
import {structureLayoutE} from './structure-e.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const bytes=fs.readFileSync(path.join(here,'ADVERSARIAL_CASES.json'));
const oracle=JSON.parse(bytes),pin=JSON.parse(fs.readFileSync(path.join(here,'PREREGISTRATION.json')));
if(crypto.createHash('sha256').update(bytes).digest('hex')!==pin.oracle_sha256)throw Error('Oracle changed');
function fixture(lines){
 const observations=lines.flatMap(([y,parts],ri)=>parts.map(([x,raw,width],ti)=>({id:`r${ri}t${ti}`,raw,page:1,kind:'text',box:{x0:x,x1:x+width,y0:y,y1:y+0.01},method:'adversarial-in-memory'})));
 return {observations,pages:[{page:1,width:600,height:840,rows:rowsFromObservations(observations,1),observationIds:observations.map(o=>o.id)}],issues:[]};
}
const certain=c=>c.status==='unambiguous'||(!c.status&&['horizontal-local','vertical-local'].includes(c.method));
const results=[];
for(const test of oracle.cases){
 const input=fixture(test.lines);
 for(const [variant,transform] of [['D',structureLayout],['E',structureLayoutE]]){
  const layout=transform(structuredClone(input));const cells=layout.structure.cells;
  const rows=layout.pages.flatMap(p=>p.rows),byId=new Map(layout.observations.map(o=>[o.id,o]));
  const checks={observations_unchanged:JSON.stringify(input.observations)===JSON.stringify(layout.observations),
   token_multiset_preserved:JSON.stringify(rows.flatMap(r=>r.tokenIds).sort())===JSON.stringify(input.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds)).sort())};
  const e=test.expect;
  if(e.rows!==undefined)checks.rows=rows.length===e.rows;
  if(e.certain!==undefined)checks.certain=cells.filter(certain).length===e.certain;
  if(e.uncertain_min!==undefined)checks.uncertainty=cells.filter(c=>!certain(c)).length>=e.uncertain_min;
  if(e.unit_raw)checks.unit=(layout.structure.records??[]).some(r=>r.unit_candidates?.some(u=>u.raw===e.unit_raw));
  if(e.column_min)checks.columns=(layout.structure.column_header_candidates??[]).length>=e.column_min;
  if(e.multiline_min)checks.multiline=cells.filter(c=>c.method==='multiline-proposal'&&!certain(c)).length>=e.multiline_min;
  if(e.distinct_value_ids)checks.distinct_values=new Set(cells.filter(certain).flatMap(c=>c.value_source_ids)).size===e.distinct_value_ids;
  if(e.value_source_count)checks.split_value=cells.filter(certain).some(c=>c.value_source_ids.length===e.value_source_count);
  if(e.forbid_label_value)checks.no_jump=!cells.filter(certain).some(c=>c.label_source_ids?.some(id=>byId.get(id).raw===e.forbid_label_value.label)&&c.value_source_ids?.some(id=>byId.get(id).raw===e.forbid_label_value.value));
  if(e.data_y!==undefined){
   const dataRows=rows.filter(r=>r.tokenIds.every(id=>Math.abs(byId.get(id).box.y0-e.data_y)<1e-6));
   checks.data_rows=dataRows.length===e.data_rows;
   const originalRow=input.pages[0].rows.find(r=>r.tokenIds.every(id=>Math.abs(byId.get(id).box.y0-e.data_y)<1e-6));
   const expected=[originalRow.tokenIds.slice(0,originalRow.tokenIds.length/2),originalRow.tokenIds.slice(originalRow.tokenIds.length/2)];
   checks.purity=expected.every(ids=>dataRows.some(row=>JSON.stringify(row.tokenIds)===JSON.stringify(ids)));
  }
  results.push({id:test.id,variant,expect:e,checks,pass:Object.values(checks).every(Boolean),layout});
 }
}
const output=process.argv[2]??path.join(here,'ADVERSARIAL_RESULTS.json');
fs.writeFileSync(output,JSON.stringify({oracle_sha256:pin.oracle_sha256,scope:oracle.scope,results},null,2)+'\n');
console.log(JSON.stringify(results.map(({id,variant,pass,checks})=>({id,variant,pass,checks})),null,2));
if(results.filter(r=>r.variant==='E').some(r=>!r.pass))process.exitCode=1;
