/**
 * QA-only, same-origin OCR staging. Never process or upload user media.
 * Run AFTER npm ci + npm install --no-save tesseract.js@5.1.0.
 * Languages come from a pinned tessdata_fast git commit, no runtime CDN.
 */
import {readFile,writeFile,copyFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const TARGET=resolve('demo/vendor/ocr');
const TESSDATA_COMMIT='87416418657359cb625c412a48b6e1d6d41c29bd';
// Opt-in only: existing LAB builds retain the original two-language asset set.
const LANGUAGES=process.argv.includes('--swedish')?['eng','fin','swe']:['eng','fin'];
const MAX_MODEL_BYTES=12*1024*1024;
const digest=b=>createHash('sha256').update(b).digest('hex');
await mkdir(resolve(TARGET,'core'),{recursive:true});
await mkdir(resolve(TARGET,'lang'),{recursive:true});
const copied=[];
async function copy(source,dest){
 const bytes=await readFile(source);
 if(bytes.length<100)throw new Error('OCR_STAGE_EMPTY_ASSET: '+source);
 await writeFile(resolve(TARGET,dest),bytes);
 copied.push({name:dest,bytes:bytes.length,sha256:digest(bytes)});
}
await copy(resolve('node_modules/tesseract.js/dist/tesseract.min.js'),'tesseract.min.js');
await copy(resolve('node_modules/tesseract.js/dist/worker.min.js'),'worker.min.js');
const coreFolder=resolve('node_modules/tesseract.js-core');
const filenames=(await readdir(coreFolder)).filter(name=>/^tesseract-core(?:-simd)?(?:-lstm)?\.wasm(?:\.js)?$/.test(name));
if(filenames.length<8)throw new Error('INCOMPLETE_LOCAL_OCR_CORE: '+filenames.join(','));
for(const name of filenames)await copy(resolve(coreFolder,name),'core/'+name);
for(const language of LANGUAGES){
 const url='https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/'+TESSDATA_COMMIT+'/'+language+'.traineddata';
 const res=await fetch(url,{redirect:'error'});
 if(!res.ok)throw new Error('OCR_LANGUAGE_FETCH_FAILED '+language+' '+res.status);
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.length<100000||bytes.length>MAX_MODEL_BYTES)throw new Error('OCR_LANGUAGE_SIZE_ERROR '+language);
 await writeFile(resolve(TARGET,'lang',language+'.traineddata'),bytes);
 copied.push({name:'lang/'+language+'.traineddata',bytes:bytes.length,sha256:digest(bytes)});
}
await writeFile(resolve(TARGET,'manifest.json'),JSON.stringify({
 version:'qa-v1.2',tesseract:'5.1.0',tessdataFastCommit:TESSDATA_COMMIT,
 items:copied
},null,2));
console.log('OCR_LOCAL_STAGE '+JSON.stringify({files:copied.length,
 languageModels:LANGUAGES,totalBytes:copied.reduce((a,x)=>a+x.bytes,0),
 tessdataCommit:TESSDATA_COMMIT}));
