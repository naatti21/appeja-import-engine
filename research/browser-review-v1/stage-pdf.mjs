/** Same locked PDF.js version, official compatibility build for browser rendering. */
import {mkdirSync,copyFileSync,renameSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='research/browser-review-v1/vendor/pdfjs';mkdirSync(root,{recursive:true});
const files=[];
for(const file of ['pdf.min.mjs','pdf.worker.min.mjs']){
 const target=root+'/'+file,tmp=target+'.tmp-'+process.pid;
 copyFileSync('node_modules/pdfjs-dist/legacy/build/'+file,tmp);renameSync(tmp,target);
 const b=readFileSync(target);files.push({file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});
}
writeFileSync(root+'/manifest.json',JSON.stringify({pdfjs:'6.4.299',build:'official legacy',files},null,2));
