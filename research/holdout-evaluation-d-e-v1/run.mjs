import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as pdfjs from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import {readPdfWithPdfJs} from '../../src/layout.mjs';
import {structureLayout} from '../ablation-layout-vocab-v1/structure.mjs';
import {structureLayoutE} from '../structure-reliability-v1/structure-e.mjs';
import {parsePayrollSectionsVocabulary} from '../ablation-layout-vocab-v1/semantic-parser.mjs';
import '../ablation-layout-vocab-v1/check-isolation.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const [input,output]=process.argv.slice(2).map(p=>path.resolve(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')};
if(pdfjs.version!=='6.4.299')throw Error('PDF.js mismatch');
const pins=JSON.parse(fs.readFileSync(path.join(here,'SOURCE_PINS.json')));
const verify=()=>{for(const f of pins)if(sha(fs.readFileSync(path.join(root,f.path)))!==f.sha256)throw Error('Source mismatch')};verify();
if(fs.existsSync(path.join(output,'OUTPUT_FREEZE.json')))throw Error('Frozen output exists');
const files=fs.readdirSync(input).filter(f=>f.endsWith('.pdf')).sort();if(files.length!==6)throw Error('Six PDFs required');
const entries=[];
for(const file of files){
 const bytes=fs.readFileSync(path.join(input,file));let t=performance.now();
 const original=await readPdfWithPdfJs(pdfjs,new Uint8Array(bytes)),reader_ms=performance.now()-t;
 write(path.join(output,'reader',file+'.json'),original);
 for(const [variant,transform] of [['D',structureLayout],['E',structureLayoutE]]){
  t=performance.now();const layout=transform(structuredClone(original));const structure_ms=performance.now()-t;
  t=performance.now();const parsed=parsePayrollSectionsVocabulary(layout);const semantic_ms=performance.now()-t;
  const observations_preserved=JSON.stringify(layout.observations)===JSON.stringify(original.observations);
  const tokens=x=>JSON.stringify(x.pages.flatMap(p=>p.rows.flatMap(r=>r.tokenIds)).sort());
  const row_tokens_preserved=tokens(layout)===tokens(original);
  const dest=path.join(output,variant,file+'.json');write(dest,{layout,parsed});
  entries.push({file,variant,pdf_sha256:sha(bytes),output:path.relative(output,dest),sha256:sha(fs.readFileSync(dest)),observations_preserved,row_tokens_preserved,raw_observations:original.observations.length,reader_ms,structure_ms,semantic_ms,memory:process.memoryUsage()});
 }
}
verify();write(path.join(output,'OUTPUT_FREEZE.json'),{frozen_at:new Date().toISOString(),node:process.version,pdfjs:pdfjs.version,platform:process.platform,arch:process.arch,ground_truth_accessed:false,entries});
console.log('Frozen '+entries.length+' outputs; annotations are not a runtime input');
