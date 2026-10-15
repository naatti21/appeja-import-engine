import test from 'node:test';
import assert from 'node:assert/strict';
import {fromPdfJsTextItems,fromTesseractWordTsv,inspectReadOnlyHandoff} from '../research/reader-bridge-v1/bridge.mjs';

const headings=['level','page_num','block_num','par_num','line_num','word_num','left','top','width','height','conf','text'];
function tsv(words){
 return [headings.join('\t'),...words.map((w,i)=>
  [5,w.page??1,1,1,w.line??1,w.word??(i+1),w.left??(50+i*50),
    w.top??100,w.width??35,w.height??18,w.conf??94,w.raw].join('\t'))].join('\n');
}
const pixels=[{width:800,height:1000}];
const rows=()=>[
 {raw:'Quantity',left:20,top:120,word:1},
 {raw:'12',left:180,top:120,word:2},
 {raw:'Buy',left:20,top:160,word:3,line:2},
 {raw:'price',left:65,top:160,word:4,line:2},
 {raw:'55.40',left:180,top:160,word:5,line:2},
 {raw:'12',left:180,top:210,word:6,line:3},
 {raw:'EUR',left:300,top:160,word:7,line:2}
];
test('TSV keeps each source word, including repeated values, without guessing financial rows',()=>{
 const layout=fromTesseractWordTsv(tsv(rows()),pixels);
 assert.deepEqual(layout.issues,[]);
 assert.equal(layout.observations.length,7);
 assert.equal(layout.observations.filter(o=>o.raw==='12').length,2);
 assert.equal(new Set(layout.observations.map(o=>o.id)).size,7);
 assert.ok(layout.observations.every(o=>o.box&&o.method==='tesseract-tsv-word'));
 assert.deepEqual(layout.observations.map(o=>o.raw),rows().map(w=>w.raw));
 assert.equal(layout.observations[0].box.x0,0.025);
 assert.equal(layout.observations[0].box.y0,0.12);
 assert.equal(layout.observations[0].ocrConfidence,94);
 assert.deepEqual(layout.pages[0].observationIds,layout.observations.map(o=>o.id));
});
test('uninterpreted OCR words are always manual-review items with all source IDs visible',()=>{
 const layout=fromTesseractWordTsv(tsv(rows()),pixels);
 const preview=inspectReadOnlyHandoff(layout);
 assert.equal(preview.status,'review-required');
 assert.equal(preview.canAutoAccept,false);assert.equal(preview.canPersist,false);
 assert.equal(preview.evidenceCount,7);
 assert.deepEqual(new Set(preview.audit.newWarnings.map(w=>w.sourceId)),
   new Set(layout.observations.map(o=>o.id)));
});
test('even a fully matched synthetic typed claim cannot authorize persistence at the bridge',()=>{
 const layout=fromTesseractWordTsv(tsv([{raw:'Quantity',left:20,top:120,word:1},
   {raw:'12',left:180,top:120,word:2}]),pixels);
 const fields={quantity:{status:'verified',value:12,
   sourceRoles:{valueIds:[layout.observations[1].id],headerIds:[layout.observations[0].id],contextIds:[]},
   sourceIds:layout.observations.map(o=>o.id)}};
 const before=JSON.stringify({layout,fields});
 const preview=inspectReadOnlyHandoff(layout,fields);
 assert.equal(preview.status,'review-required');assert.equal(preview.canPersist,false);
 assert.equal(preview.audit.validatedEvidence.length,1);
 assert.equal(JSON.stringify({layout,fields}),before);
});
test('extra money hidden in declared value sources is warned at its original OCR ID',()=>{
 const layout=fromTesseractWordTsv(tsv([{raw:'Quantity',left:20,top:120,word:1},
   {raw:'12',left:180,top:120,word:2},{raw:'73.21',left:280,top:120,word:3}]),pixels);
 const [header,value,extra]=layout.observations.map(o=>o.id);
 const fields={quantity:{status:'verified',value:12,
   sourceRoles:{valueIds:[value,extra],headerIds:[header],contextIds:[]},
   sourceIds:[value,extra,header]}};
 const preview=inspectReadOnlyHandoff(layout,fields);
 assert.equal(preview.audit.canAutoAccept,false);
 assert.ok(preview.audit.newWarnings.some(w=>w.sourceId===extra));
 assert.equal(preview.canPersist,false);
});
test('legacy untyped source claim cannot be upgraded by the bridge',()=>{
 const layout=fromTesseractWordTsv(tsv([{raw:'12'}]),pixels);
 const preview=inspectReadOnlyHandoff(layout,{quantity:{status:'verified',value:12,
   sourceIds:[layout.observations[0].id]}});
 assert.ok(preview.issues.some(x=>x.code==='UNTYPED_OR_MISSING_VALUE_CLAIM'));
 assert.equal(preview.status,'review-required');
});
test('malformed TSV header is an explicit block rather than an empty clean document',()=>{
 const result=fromTesseractWordTsv('level\ttext\n5\t100',pixels);
 assert.equal(result.issues[0].code,'INVALID_TSV_HEADER');
 assert.equal(inspectReadOnlyHandoff(result).canPersist,false);
});
test('truncated level-5 lines cannot be silently ignored',()=>{
 const result=fromTesseractWordTsv(tsv([{raw:'12'}])+'\n5\t1',pixels);
 assert.ok(result.issues.some(x=>x.code==='TRUNCATED_TSV_ROW'));
 assert.equal(result.observations.length,1);
 assert.equal(inspectReadOnlyHandoff(result).status,'review-required');
});
test('duplicate TSV word address remains visible and blocks',()=>{
 const result=fromTesseractWordTsv(tsv([{raw:'10',word:1},{raw:'11',word:1}]),pixels);
 assert.equal(result.observations.length,2);
 assert.ok(result.issues.some(x=>x.code==='DUPLICATE_TSV_WORD_ADDRESS'));
 assert.equal(inspectReadOnlyHandoff(result).canAutoAccept,false);
});
test('out-of-page boxes stay as raw evidence and issue, never upgraded to verified geometry',()=>{
 const result=fromTesseractWordTsv(tsv([{raw:'700.25',left:900}]),pixels);
 assert.equal(result.observations.length,1);
 assert.equal(result.observations[0].raw,'700.25');
 assert.equal(result.observations[0].box,null);
 assert.ok(result.issues.some(x=>x.code==='INVALID_OCR_WORD_GEOMETRY'));
 assert.equal(inspectReadOnlyHandoff(result).canAutoAccept,false);
});
test('invalid page retains unplaced raw content and blocks all acceptance',()=>{
 const result=fromTesseractWordTsv(tsv([{raw:'105.00',page:99}]),pixels);
 assert.equal(result.unplacedObservations[0].raw,'105.00');
 assert.ok(result.issues.some(x=>x.code==='INVALID_OCR_PAGE'));
 assert.equal(inspectReadOnlyHandoff(result).unplacedCount,1);
});
test('flattened Palkka extractPdfText cannot be mistaken for traceable PDF item evidence',()=>{
 const layout=fromPdfJsTextItems('Maksupäivä 13.10.2026\nBrutto 3 200,00');
 assert.equal(layout.issues[0].code,'FLATTENED_PDF_TEXT_UNVERIFIABLE');
 assert.equal(inspectReadOnlyHandoff(layout).canAutoAccept,false);
});
test('native PDF.js item fixtures retain page, PDF token and source geometry',()=>{
 const layout=fromPdfJsTextItems([{width:600,height:800,
  items:[{str:'Payment date',transform:[1,0,0,14,30,730],width:110,height:14},
         {str:'2027-03-19',transform:[1,0,0,14,250,730],width:95,height:14}]},
  {width:600,height:800,items:[{str:'Gross pay',transform:[1,0,0,14,30,700],width:95,height:14},
         {str:'3201.25',transform:[1,0,0,14,250,700],width:80,height:14}]}]);
 assert.deepEqual(layout.issues,[]);
 assert.equal(layout.observations.length,4);
 assert.equal(layout.observations[3].page,2);
 assert.equal(layout.observations[3].id,'pdf-p2-t2');
 assert.equal(inspectReadOnlyHandoff(layout).status,'review-required');
});
test('PDF missing item geometry is reported with original raw token, not silently omitted',()=>{
 const layout=fromPdfJsTextItems([{width:600,height:800,items:[{str:'Gross pay',width:95}]}]);
 assert.equal(layout.observations.length,1);assert.equal(layout.observations[0].raw,'Gross pay');
 assert.ok(layout.issues.length>=1);
 assert.equal(inspectReadOnlyHandoff(layout).canPersist,false);
});
