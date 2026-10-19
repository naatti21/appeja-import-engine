/**
 * Add a source-locked, entirely fictional instrument-review route to the
 * existing standalone LAB artifact. Does NOT deploy or alter the root LAB.
 */
import {rm,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

await rm('dist',{recursive:true,force:true});
await import('./build-mobile-lab-preview.mjs');
const dst=relative=>resolve('dist',relative);
async function copy(path){
 await mkdir(dirname(dst(path)),{recursive:true});
 await copyFile(resolve(path),dst(path));
}
const paths=[
 'demo/portfolio-identity-review-entry.mjs',
 'demo/issue55-samples.mjs',
 'tests/fixtures/issue55-name-role.mjs'
];
for(const path of paths)await copy(path);

const original=await readFile('demo/portfolio-identity-review.html','utf8');
const fileControl='<label for="portfolioFile">Valitse testikuva</label><input id="portfolioFile" type="file" accept="image/png,image/jpeg,image/webp">';
const entry='<script type="module" src="./portfolio-identity-review-entry.mjs"></script>';
if(!original.includes(fileControl)||!original.includes(entry)||!original.includes('Ei tallennusta'))
  throw Error('PREVIEW_REVIEW_UI_CONTRACT_CHANGED');
const picker=`<section id="syntheticExamples" aria-label="Fiktiiviset esimerkkikuvat">
<h2>Valitse testitilanne</h2>
<p>Vain nämä täysin keksityt kuvat. Oikeiden salkku- tai pankkikuvien lataaminen on tässä esikatselussa poistettu käytöstä.</p>
<div class="actions">
<button type="button" data-sample-mode="faint">Haalea nimi</button>
<button type="button" data-sample-mode="absent">Puuttuva nimi</button>
<button type="button" data-sample-mode="clean">Selkeä vertailukuva</button>
</div>
<p id="sampleHelp" role="status" aria-live="polite">Valitse esimerkkikuva ja paina sitten Lue kuva.</p>
</section>
<input hidden id="portfolioFile" type="file" accept="image/png">`;
let html=original.replace(fileControl,picker)
  .replace(entry,entry+'\n<script type="module" src="./issue55-samples.mjs"></script>')
  .replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');
if(html===original||html.includes(fileControl)||!html.includes('data-sample-mode="absent"'))throw Error('SAMPLE_ONLY_PREVIEW_FAILED');
await writeFile(dst('demo/portfolio-identity-review.html'),html);

// The Work-audited source remains unchanged. Only the packaged copy is
// adapted for project-site subpaths (/appeja-import-engine/), not absolute /.
let module=await readFile('demo/portfolio-identity-review.mjs','utf8');
for(const [oldValue,newValue] of [
 ["location.origin+'/demo/vendor/ocr/worker.min.js'","new URL('./vendor/ocr/worker.min.js',import.meta.url).href"],
 ["location.origin+'/demo/vendor/ocr/core'","new URL('./vendor/ocr/core',import.meta.url).href"],
 ["location.origin+'/demo/vendor/ocr/lang'","new URL('./vendor/ocr/lang',import.meta.url).href"]
]){
 if(!module.includes(oldValue))throw Error('OCR_BASE_PATH_CONTRACT_CHANGED: '+oldValue);
 module=module.replace(oldValue,newValue);
}
await writeFile(dst('demo/portfolio-identity-review.mjs'),module);
console.log('ISSUE55_SYNTHETIC_LAB_STAGED '+JSON.stringify({
  route:'demo/portfolio-identity-review.html',rootUnchanged:true,
  syntheticModes:['faint','absent','clean'],filePickerHidden:true,
  externalResolver:false,productionWrites:false,publish:false
}));
