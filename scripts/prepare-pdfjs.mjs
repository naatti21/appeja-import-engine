import {copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve('node_modules/pdfjs-dist/build');
const target=resolve('demo/vendor/pdfjs');
await mkdir(target,{recursive:true});
for(const name of ['pdf.min.mjs','pdf.worker.min.mjs']){
  await copyFile(resolve(source,name),resolve(target,name));
}
console.log('Prepared version-pinned local PDF.js for the synthetic-only demo.');
