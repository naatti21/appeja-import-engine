/**
 * Combine the last successfully published, PINNED original LAB into the
 * same Pages artifact as the new, segregated fictional issue55 test route.
 * Original root and demo paths remain byte-for-byte identical to pinned LAB.
 *
 * Never include git history, user files, source PR documents, QA logs or
 * prototype upload routes from the new branch.
 */
import {cp,rm,rename,mkdir,readFile,stat,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=resolve('baseline/dist'),candidate=resolve('dist'),output=resolve('pages-assembled');
const sha=x=>createHash('sha256').update(x).digest('hex');
const entries=[
 'demo/portfolio-identity-review.html',
 'demo/portfolio-identity-review-entry.mjs',
 'demo/portfolio-identity-review.mjs',
 'demo/issue55-samples.mjs',
 'tests/fixtures/issue55-name-role.mjs'
];
const dirs=['src','demo/vendor/ocr'];
await rm(output,{recursive:true,force:true});
await cp(base,output,{recursive:true});
const originalIndex=await readFile(resolve(base,'index.html'));
assert.equal(sha(await readFile(resolve(output,'index.html'))),sha(originalIndex));
const prefix=resolve(output,'issue55-test');
for(const dir of dirs)await cp(resolve(candidate,dir),resolve(prefix,dir),{recursive:true});
for(const path of entries){
 const from=resolve(candidate,path),to=resolve(prefix,path);
 await mkdir(dirname(to),{recursive:true});
 await cp(from,to);
}
const staged=await readFile(resolve(prefix,'demo/portfolio-identity-review.html'),'utf8');
assert.match(staged,/id="syntheticExamples"/);
assert.match(staged,/data-sample-mode="faint"/);
assert.match(staged,/data-sample-mode="absent"/);
assert.match(staged,/data-sample-mode="clean"/);
assert.match(staged,/input hidden id="portfolioFile"/);
assert.doesNotMatch(staged,/Valitse testikuva/);
assert.match(staged,/noindex,nofollow,noarchive/);
assert.equal(sha(await readFile(resolve(output,'index.html'))),sha(originalIndex));
assert.equal(sha(await readFile(resolve(output,'demo/mobile-source-review.html'))),
             sha(await readFile(resolve(base,'demo/mobile-source-review.html'))));
assert.equal(sha(await readFile(resolve(output,'demo/mobile-source-review.mjs'))),
             sha(await readFile(resolve(base,'demo/mobile-source-review.mjs'))));
assert.deepEqual((await readdir(prefix)).sort(),['demo','src','tests']);
for(const file of ['demo/vendor/ocr/lang/eng.traineddata','demo/vendor/ocr/lang/fin.traineddata',
  'src/portfolio-identity-review.mjs','src/portfolio-instrument-listings.mjs']){
  assert.ok((await stat(resolve(prefix,file))).size>100,file);
}
await rm(resolve('dist'),{recursive:true,force:true});
await rename(output,resolve('dist'));
console.log('ISSUE55_PAGES_PRESERVED_BASELINE '+JSON.stringify({
  previousLabSha:'294dac1b1a79fb148acb48f7ada9e8c9cc433633',
  originalIndexSha256:sha(originalIndex),originalLabPreserved:true,
  route:'/issue55-test/demo/portfolio-identity-review.html',fictionalOnly:true,
  files:entries.length,dirs:dirs.length,noFinancialStorage:true
}));
