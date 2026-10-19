/** Fail-closed static package checks for the supplemental sample-only LAB route. */
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const get=async path=>(await readFile(resolve('dist',path),'utf8'));
const html=await get('demo/portfolio-identity-review.html');
const root=await get('index.html'),sample=await get('demo/issue55-samples.mjs');
const review=await get('demo/portfolio-identity-review.mjs');
const fixture=await get('tests/fixtures/issue55-name-role.mjs');
assert.match(root,/src="\.\/demo\/mobile-source-review\.mjs"/);
assert.doesNotMatch(root,/issue55-samples|portfolio-identity-review/);
assert.match(html,/id="syntheticExamples"/);
assert.match(html,/noindex,nofollow,noarchive/);
assert.match(html,/<input hidden id="portfolioFile" type="file" accept="image\/png">/);
assert.doesNotMatch(html,/Valitse testikuva|type="file" accept="image\/png,image/);
for(const mode of ['clean','faint','absent'])assert.match(html,new RegExp('data-sample-mode="'+mode+'"'));
assert.match(html,/src="\.\/portfolio-identity-review-entry\.mjs"/);
assert.match(html,/src="\.\/issue55-samples\.mjs"/);
assert.match(html,/Ei tallennusta/);
assert.match(html,/content="default-src 'self';/);
assert.match(sample,/issue55Fixture/);
assert.match(sample,/new DataTransfer/);
assert.match(fixture,/mode==='faint'/);
assert.match(review,/new URL\('\.\/vendor\/ocr\/worker\.min\.js',import\.meta\.url\)/);
assert.match(review,/new URL\('\.\/vendor\/ocr\/lang',import\.meta\.url\)/);
assert.doesNotMatch(review,/location\.origin\+'\/demo\/vendor/);
assert.doesNotMatch(review,/localStorage\s*\.\s*setItem|indexedDB\s*\.\s*open|navigator\.sendBeacon/);
for(const item of [
 'demo/portfolio-identity-review-entry.mjs',
 'demo/vendor/ocr/tesseract.min.js',
 'demo/vendor/ocr/worker.min.js',
 'demo/vendor/ocr/lang/eng.traineddata',
 'demo/vendor/ocr/lang/fin.traineddata',
 'src/portfolio-identity-review.mjs',
 'src/portfolio-instrument-listings.mjs'
])assert.ok((await stat(resolve('dist',item))).size>0,item);
assert.deepEqual((await readdir('dist')).sort(),['.nojekyll','demo','index.html','robots.txt','src','tests'].sort());
assert.deepEqual((await readdir('dist/tests')).sort(),['fixtures']);
assert.deepEqual((await readdir('dist/tests/fixtures')).sort(),['issue55-name-role.mjs']);
assert.deepEqual((await readdir('dist/demo')).sort(),[
 'complete-pdf.mjs','issue55-samples.mjs','mobile-source-review.html',
 'mobile-source-review.mjs','portfolio-identity-review-entry.mjs',
 'portfolio-identity-review.html','portfolio-identity-review.mjs','vendor'
].sort());
console.log('ISSUE55_SYNTHETIC_PREVIEW_VERIFY_PASS');
