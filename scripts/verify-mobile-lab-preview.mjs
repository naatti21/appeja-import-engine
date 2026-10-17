/**
 * Fail-closed verification for the isolated public LAB preview artifact.
 * This checks only packaging/integrity; it is not security or product QA.
 */
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root=resolve('dist');
const get=relative=>readFile(resolve(root,relative));
const txt=async relative=>(await get(relative)).toString('utf8');
const rootHtml=await txt('index.html');
const detailHtml=await txt('demo/mobile-source-review.html');
assert.match(rootHtml,/src="\.\/demo\/mobile-source-review\.mjs"/);
assert.match(detailHtml,/src="\.\/mobile-source-review\.mjs"/);
assert.match(rootHtml,/robots" content="noindex/);
assert.match(rootHtml,/Peruuta ja tyhjennä/);
assert.match(rootHtml,/Ei tallennusta/);
assert.match(rootHtml,/id="fileImport"/);
assert.match(rootHtml,/id="issuePanel"/);
assert.match(await txt('robots.txt'),/Disallow: \//);
assert.equal((await get('.nojekyll')).byteLength,0);
for(const target of ['demo/mobile-source-review.mjs','demo/complete-pdf.mjs',
 'src/review-draft.mjs','src/import-observations.mjs','src/holdings.mjs',
 'src/payroll-sections.mjs','src/layout.mjs','src/positioned-holdings.mjs',
 'src/numbers.mjs','src/csv.mjs','src/acceptance.mjs','src/payroll-lines.mjs',
 'src/xlsx.mjs','demo/vendor/pdfjs/pdf.min.mjs','demo/vendor/pdfjs/pdf.worker.min.mjs']){
 assert.ok((await stat(resolve(root,target))).size>0,target);
}
const manifest=JSON.parse(await txt('demo/vendor/ocr/manifest.json'));
assert.equal(manifest.tesseract,'5.1.0');
for(const item of manifest.items){
 const data=await get('demo/vendor/ocr/'+item.name);
 assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256,item.name);
 assert.equal(data.length,item.bytes,item.name);
}
assert.ok(manifest.items.some(x=>x.name==='lang/eng.traineddata'));
assert.ok(manifest.items.some(x=>x.name==='lang/fin.traineddata'));
const source=await txt('demo/mobile-source-review.mjs');
assert.match(source,/correctReviewField/);
assert.match(source,/URL\.revokeObjectURL/);
assert.ok(!/localStorage\s*\.\s*setItem|indexedDB\s*\.\s*open|navigator\.sendBeacon|fetch\s*\(/.test(source));
const top=await readdir(root);
assert.deepEqual(top.slice().sort(),['.nojekyll','demo','index.html','robots.txt','src'].sort());
const demoFiles=await readdir(resolve(root,'demo'));
assert.deepEqual(demoFiles.slice().sort(),['complete-pdf.mjs','mobile-source-review.html','mobile-source-review.mjs','vendor'].sort());
console.log('LAB_PREVIEW_PACKAGE_PASS '+JSON.stringify({entry:'index.html',nodeModules:false,
 originalFinancialFiles:false,sameOriginAssets:true,ocrCount:manifest.items.length}));
