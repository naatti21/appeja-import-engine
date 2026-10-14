// Runtime-only repeated Node measurements on the six real-reader snapshots.
// Separate D/E processes; not Android, PDF decode, UI, or true peak-memory measurement.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {structureLayout} from '../ablation-layout-vocab-v1/structure.mjs';
import {structureLayoutE} from './structure-e.mjs';
import {parsePayrollSectionsVocabulary} from '../ablation-layout-vocab-v1/semantic-parser.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const variant=process.argv[2];if(!['D','E'].includes(variant))throw Error('D or E required');
const transform=variant==='D'?structureLayout:structureLayoutE;
const docs=['P01','P02','P03','T01','T02','T03'].map(id=>JSON.parse(fs.readFileSync(path.join(here,'raw',id+'-reader.json'))).layout);
function run(){let n=0;for(const d of docs){const l=transform(structuredClone(d));n+=parsePayrollSectionsVocabulary(l).rows;}return n;}
for(let i=0;i<20;i++)run();
global.gc?.();const memory_before=process.memoryUsage();
const samples=[],snapshots=[];let checksum=0;
for(let i=0;i<80;i++){const t=performance.now();checksum+=run();samples.push(performance.now()-t);snapshots.push(process.memoryUsage());}
global.gc?.();const memory_after_gc=process.memoryUsage();
const sorted=[...samples].sort((a,b)=>a-b);
const result={variant,scope:'Clone+structure+unchanged semantic adapter over six stored real-reader layouts; no PDF decode',
 node:process.version,warmup_batches:20,measured_batches:80,documents_per_batch:6,samples_ms:samples,
 median_batch_ms:(sorted[39]+sorted[40])/2,p95_batch_ms:sorted[Math.ceil(sorted.length*.95)-1],
 memory_before,memory_after_gc,sampled_max_rss:Math.max(...snapshots.map(m=>m.rss)),checksum,
 caveat:'One isolated process per variant; sampled RSS is not a true peak, retained delta is not a calibrated memory budget'};
fs.writeFileSync(path.join(here,`BENCHMARK_${variant}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
