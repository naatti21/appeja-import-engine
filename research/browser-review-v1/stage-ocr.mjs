/** Test-build assets only; no runtime CDN and no uploaded document ever leaves browser. */
import {mkdir,copyFile,readdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {createHash} from 'node:crypto';
const root=resolve('research/browser-review-v1/vendor/ocr'),items=[];
await mkdir(root+'/core',{recursive:true});await mkdir(root+'/lang',{recursive:true});
async function copy(src,dest){await copyFile(src,root+'/'+dest);const b=await readFile(root+'/'+dest);items.push({file:dest,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
await copy('node_modules/tesseract.js/dist/tesseract.min.js','tesseract.min.js');await copy('node_modules/tesseract.js/dist/worker.min.js','worker.min.js');
for(const f of await readdir('node_modules/tesseract.js-core'))if(/^tesseract-core(?:-simd)?(?:-lstm)?\.wasm(?:\.js)?$/.test(f))await copy('node_modules/tesseract.js-core/'+f,'core/'+f);
const data='node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
await copy(data,'lang/eng.traineddata.gz');
await writeFile(root+'/manifest.json',JSON.stringify({tesseract:'5.1.0',engPackage:'1.0.0',model:'4.0.0_best_int',items},null,2));
console.log('OCR staged same-origin:',items.length,'files');
