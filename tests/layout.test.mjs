import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutFromPdfItems,rowsFromObservations,readPdfWithPdfJs} from '../src/layout.mjs';
import {parsePayrollLayout} from '../src/payroll.mjs';
import {payLayout,payrollPage} from './fixtures.mjs';

test('P0-04: two pages 42k and 43k are both retained, never auto-accepted',()=>{
  const layout=payLayout([{ytd:'42 000,00'},{ytd:'43 000,00'}]);
  const result=parsePayrollLayout(layout);
  assert.equal(result.fields.ytdTaxableIncome.status,'conflict');
  assert.deepEqual(result.fields.ytdTaxableIncome.candidates.map(c=>c.value),[42000,43000]);
  assert.equal(result.blocks,2);
  assert.equal(result.canAutoAccept,false);
});
test('P0-03: same-page repeated blocks retain contradictory YTD evidence',()=>{
  const result=parsePayrollLayout(layoutFromPdfItems([payrollPage({secondBlock:'43 000,00'})]));
  assert.equal(result.fields.ytdTaxableIncome.status,'conflict');
  assert.equal(result.canAutoAccept,false);
});
test('identical repeats are valid observations, not conflicts',()=>{
  const result=parsePayrollLayout(payLayout([{ytd:'42 000,00'},{ytd:'42 000,00'}]));
  assert.equal(result.fields.ytdTaxableIncome.status,'unique');
  assert.equal(result.fields.ytdTaxableIncome.candidates.length,2);
  assert.equal(result.canAutoAccept,true);
});
test('reversed column order is interpreted by header x rather than token order',()=>{
  const result=parsePayrollLayout(payLayout([{reverse:true}]));
  assert.equal(result.fields.grossPay.value,3200);
  assert.equal(result.fields.ytdTaxableIncome.value,42000);
  assert.equal(result.fields.previousYearTaxableIncome.value,38000);
  assert.equal(result.canAutoAccept,true);
});
test('incomplete middle column cannot hide missing YTD',()=>{
  const result=parsePayrollLayout(payLayout([{includeYtd:false}]));
  assert.equal(result.fields.ytdTaxableIncome.status,'missing');
  assert.equal(result.canAutoAccept,false);
  assert.ok(result.issues.some(x=>x.code==='MISSING_TABLE_VALUE'));
});
test('page evidence tracks observation ID and page',()=>{
  const result=parsePayrollLayout(payLayout([{},{}]));
  assert.deepEqual(result.fields.ytdTaxableIncome.candidates.map(c=>c.page),[1,2]);
  assert.equal(new Set(result.fields.ytdTaxableIncome.candidates.map(c=>c.observationId)).size,2);
});
test('unsupported PDF text rotation is observed and blocks approval',()=>{
  const layout=layoutFromPdfItems([payrollPage({corruptGeo:true})]);
  assert.ok(layout.issues.some(x=>x.code==='UNSUPPORTED_TEXT_ROTATION'));
  assert.equal(parsePayrollLayout(layout).canAutoAccept,false);
  assert.equal(layout.observations.length,7);
});
test('duplicate semantic headers block even with consistent numbers',()=>{
  const result=parsePayrollLayout(layoutFromPdfItems([payrollPage({identicalHeader:true})]));
  assert.equal(result.canAutoAccept,false);
  assert.ok(result.issues.some(x=>x.code==='DUPLICATE_TABLE_COLUMN'));
});
test('unsupported one-line PDF text observation is not quietly dropped',()=>{
  const layout=layoutFromPdfItems([{width:1000,height:1200,items:[{str:'99 999,99',width:200}]}]);
  assert.equal(layout.observations.length,1);
  assert.equal(layout.observations[0].box,null);
  assert.ok(layout.issues.some(x=>x.code==='INVALID_GEOMETRY'));
  assert.equal(parsePayrollLayout(layout).canAutoAccept,false);
});
test('token y jitter is grouped within the same visual row',()=>{
  const input=[{str:'A',width:30,height:15,transform:[10,0,0,10,20,900]},
    {str:'B',width:30,height:15,transform:[10,0,0,10,120,897]}];
  const layout=layoutFromPdfItems([{width:1000,height:1200,items:input}]);
  assert.equal(layout.pages[0].rows.length,1);
});
test('PDF.js bridge accepts injected pages, no package or network needed',async()=>{
  let destroyed=false;
  const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:1,
    getPage:async()=>({getViewport:()=>({rotation:0,width:1000,height:1200}),
      getTextContent:async()=>({items:payrollPage().items})}),
    destroy:async()=>{destroyed=true;}
  })})};
  const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array([1,2]));
  assert.equal(layout.observations.length,7);
  assert.ok(destroyed);
});
test('PDF.js bridge blocks rotated pages rather than mislabeling fields',async()=>{
  let destroyed=false;
  const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:1,
    getPage:async()=>({getViewport:()=>({rotation:90,width:1200,height:1000})}),
    destroy:async()=>{destroyed=true;}
  })})};
  await assert.rejects(readPdfWithPdfJs(pdfjs,new Uint8Array([1])),/kierretty/);
  assert.ok(destroyed);
});

test('PDF.js bridge blocks cropped-origin pages rather than misplacing tokens',async()=>{
  let destroyed=false;
  const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:1,
    getPage:async()=>({view:[100,0,1100,1200],getViewport:()=>({rotation:0,width:1000,height:1200})}),
    destroy:async()=>{destroyed=true;}
  })})};
  await assert.rejects(readPdfWithPdfJs(pdfjs,new Uint8Array([1])),/cropbox/);
  assert.ok(destroyed);
});

test('negative gross amount is preserved but not auto-accepted',()=>{
  const layout=payLayout([{gross:'-3 200,00'}]);
  const parsed=parsePayrollLayout(layout);
  assert.equal(parsed.canAutoAccept,false);
  assert.ok(parsed.issues.some(i=>i.code==='INVALID_MONEY_CELL'));
  assert.ok(parsed.unmatched.some(t=>t.raw==='-3 200,00'));
});


test('severely shifted YTD token is never assigned to gross column',()=>{
  const layout=payLayout([{}]);
  const token=layout.observations.find(t=>t.raw==='42 000,00');
  token.box={...token.box,x0:token.box.x0-0.15,x1:token.box.x1-0.15};
  const out=parsePayrollLayout(layout);
  assert.equal(out.canAutoAccept,false);
  assert.ok(out.issues.some(i=>i.code==='AMBIGUOUS_MONEY_COLUMN'));
});

test('financial token on an otherwise unanchored data row blocks the batch',()=>{
  const page=payrollPage();
  page.items.push({str:'99 999,00',transform:[11,0,0,11,580,893],width:80,height:19});
  const layout=layoutFromPdfItems([page]);
  const out=parsePayrollLayout(layout);
  assert.equal(out.canAutoAccept,false);
  assert.ok(out.issues.some(i=>i.code==='UNANCHORED_MONEY_ROW'));
});
