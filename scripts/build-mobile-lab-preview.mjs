/**
 * Standalone, read-only LAB preview package. Never include user files,
 * QA artifacts, .git, project docs or application persistence stores.
 * Prereqs: npm ci; npm install tesseract.js@5.1.0 --no-save;
 *           node scripts/prepare-pdfjs.mjs;
 *           node scripts/prepare-local-ocr.mjs
 */
import {cp,mkdir,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const out=resolve('dist');
await mkdir(out,{recursive:true});

async function copy(source,target){
 const content=await readFile(resolve(source));
 await mkdir(dirname(resolve(out,target)),{recursive:true});
 await writeFile(resolve(out,target),content);
}
const src=(await readdir('src')).filter(file=>/^[a-z0-9_-]+\.mjs$/.test(file));
if(src.length<10)throw Error('PREVIEW_SOURCE_SET_INCOMPLETE');
for(const file of src)await copy('src/'+file,'src/'+file);
await copy('demo/mobile-source-review.mjs','demo/mobile-source-review.mjs');
await copy('demo/complete-pdf.mjs','demo/complete-pdf.mjs');
for(const filename of ['pdf.min.mjs','pdf.worker.min.mjs']){
 await copy('demo/vendor/pdfjs/'+filename,'demo/vendor/pdfjs/'+filename);
}
const raw=await readFile('demo/vendor/ocr/manifest.json','utf8');
const manifest=JSON.parse(raw);
if(manifest.tesseract!=='5.1.0'||manifest.items.length<12 ||
   !['eng','fin'].every(lang=>manifest.items.some(item=>item.name==='lang/'+lang+'.traineddata')))
 throw Error('PREVIEW_OCR_MANIFEST_INCOMPLETE');
for(const item of manifest.items){
 if(!/^(?:core\/[a-z0-9.-]+|lang\/(?:eng|fin)\.traineddata|(?:worker|tesseract)\.min\.js)$/.test(item.name))
   throw Error('UNAPPROVED_PREVIEW_ASSET: '+item.name);
 const from='demo/vendor/ocr/'+item.name;
 const bytes=await readFile(from);
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256 || bytes.length!==item.bytes)
   throw Error('PREVIEW_OCR_ASSET_INTEGRITY_FAILED: '+item.name);
 await copy(from,from);
}
await copy('demo/vendor/ocr/manifest.json','demo/vendor/ocr/manifest.json');

let html=await readFile('demo/mobile-source-review.html','utf8');
if(!html.includes('src="./mobile-source-review.mjs"')||!html.includes('Ei tallennusta') &&
   !html.includes('Tallennus on estetty'))throw Error('PREVIEW_HTML_CONTRACT_CHANGED');
const inject='<meta name="robots" content="noindex,nofollow,noarchive">\n';
html=html.replace('</head>',inject+'</head>');
await writeFile(resolve(out,'demo/mobile-source-review.html'),html);
await writeFile(resolve(out,'index.html'),
 html.replace('src="./mobile-source-review.mjs"','src="./demo/mobile-source-review.mjs"'));
await writeFile(resolve(out,'.nojekyll'),'');
await writeFile(resolve(out,'robots.txt'),'User-agent: *\nDisallow: /\n');

const htmlState=await stat(resolve(out,'index.html'));
if(htmlState.size<2000)throw Error('INVALID_PREVIEW_ENTRY');
console.log('LAB_PREVIEW_BUILD '+JSON.stringify({sourceModules:src.length,ocrAssets:manifest.items.length,
 pdfjsAssets:2,entry:'/index.html',noUserData:true}));
