import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {syntheticHoldingsXlsx,zipTestFiles} from './fixtures/native-xlsx.mjs';
import {parseXlsx,xlsxSheetToHoldingsTable} from '../src/xlsx.mjs';
import {parseHoldingsCsv} from '../src/holdings.mjs';
import {evidenceFromDelimited,evidenceFromXlsx,evidenceFromPdfLayout,evidenceFromOcrTsv} from '../src/import-observations.mjs';
import {layoutFromPdfItems} from '../src/layout.mjs';
const inflateRaw=data=>inflateRawSync(data);
const csv=['Ticker,Name,Quantity,Buy Price,Currency','NOKIA,Nokia,10,3.5,EUR','MSFT,Microsoft,2,400,USD'].join('\n');
const simplified=source=>source.records.map(row=>
 Object.fromEntries(['ticker','name','quantity','buyPrice','currency'].map(key=>
 [key,row.fields[key]?.value??null])));
test('genuine deflate XLSX: workbook, named sheets and cell provenance',async()=>{
 const result=await parseXlsx(syntheticHoldingsXlsx(),{inflateRaw});
 assert.equal(result.sheets.length,2);
 assert.deepEqual(result.sheets.map(s=>s.name),['Salkku','Meta']);
 assert.equal(result.issues.length,0);
 assert.equal(result.observations.find(c=>c.address==='D3'&&c.sheet==='Salkku').raw,'400');
 const table=xlsxSheetToHoldingsTable(result,'Salkku');
 assert.deepEqual(table.rows.map(r=>r.values),[
  ['Ticker','Name','Quantity','Buy Price','Currency'],
  ['NOKIA','Nokia','10','3.5','EUR'],
  ['MSFT','Microsoft','2','400','USD']
 ]);
 assert.deepEqual(simplified(parseHoldingsCsv(table)),simplified(parseHoldingsCsv(csv)));
});
test('CSV vs XLSX canonical evidence preserves all cell positions and values',async()=>{
 const c=evidenceFromDelimited(csv);
 const x=await evidenceFromXlsx(syntheticHoldingsXlsx(),{inflateRaw});
 assert.equal(c.observations.length,15);
 assert.equal(x.observations.filter(o=>o.source.sheet==='Salkku').length,15);
 assert.deepEqual(c.observations.map(o=>o.raw),x.observations.filter(o=>o.source.sheet==='Salkku').map(o=>o.raw));
 assert.ok(x.observations.some(o=>o.source.sheet==='Meta'));
 assert.equal(x.canPersist,false);
 assert.equal(c.canPersist,false);
});
test('genuine stored XLSX uses same observable cell values',async()=>{
 const result=await parseXlsx(syntheticHoldingsXlsx({compress:false}),{inflateRaw});
 assert.equal(result.sheets[0].rows.length,3);
});
test('XLSX formulas remain visible but block automatic verification',async()=>{
 const sheet=await parseXlsx(syntheticHoldingsXlsx({formula:true}),{inflateRaw});
 assert.ok(sheet.issues.some(i=>i.code==='FORMULA_VALUE_UNVERIFIED'&&i.cell==='D3'));
 const e=await evidenceFromXlsx(syntheticHoldingsXlsx({formula:true}),{inflateRaw});
 assert.equal(e.requiresReview,true);
 assert.equal(e.observations.find(o=>o.source.address==='D3').formula,true);
});
test('XLSX tampered compressed bytes fail integrity',async()=>{
 const bytes=syntheticHoldingsXlsx();
 const corrupt=bytes.slice();
 corrupt[180]^=0xff;
 await assert.rejects(()=>parseXlsx(corrupt,{inflateRaw}));
});
test('XLSX unsafe ZIP path cannot be imported',async()=>{
 const bytes=zipTestFiles({'../outside.xml':'bad'});
 await assert.rejects(()=>parseXlsx(bytes,{inflateRaw}),/UNSAFE_ZIP_PATH/);
});
test('XLSX corrupt file is not interpreted as spreadsheet',async()=>{
 await assert.rejects(()=>parseXlsx(new TextEncoder().encode('not a workbook'),{inflateRaw}));
});
test('sheet references are real, not cross-sheet guesses',async()=>{
 const book=await parseXlsx(syntheticHoldingsXlsx(),{inflateRaw});
 assert.throws(()=>xlsxSheetToHoldingsTable(book,'Unknown'),/SHEET_NOT_FOUND/);
});
test('PDF observations enter common envelope with page geometry, no invented table semantics',()=>{
 const layout=layoutFromPdfItems([{width:500,height:800,items:[
  {str:'NOKIA',width:40,height:12,transform:[12,0,0,12,20,700]},
  {str:'10',width:14,height:12,transform:[12,0,0,12,140,700]}
 ]}]);
 const e=evidenceFromPdfLayout(layout);
 assert.equal(e.observations.length,2);
 assert.equal(e.observations[0].source.page,1);
 assert.ok(e.observations[0].source.box.x1>e.observations[0].source.box.x0);
 assert.equal(e.tables.length,0);
 assert.equal(e.canPersist,false);
});
const OCR_HEADER='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const OCR_ROWS=[
 '5\t1\t1\t1\t1\t1\t12\t20\t44\t18\t93\tNOKIA',
 '5\t1\t1\t1\t1\t2\t170\t20\t18\t18\t90\t10',
 '5\t1\t1\t1\t2\t1\t12\t55\t54\t18\t75\tMSFT'
];
test('OCR TSV words preserve image coordinates and confidence without assuming correct holdings',()=>{
 const e=evidenceFromOcrTsv([OCR_HEADER,...OCR_ROWS].join('\n'),{imageWidth:400,imageHeight:200});
 assert.equal(e.observations.length,3);
 assert.equal(e.observations[0].ocrConfidence,93);
 assert.equal(e.observations[0].source.box.x0,0.03);
 assert.equal(e.requiresReview,true);
 assert.equal(e.canPersist,false);
});
test('OCR malformed geometry and confidence trigger source blockers',()=>{
 const invalid='5\t1\t1\t1\t1\t1\t-1\t20\t44\t18\t103\tNOKIA';
 const e=evidenceFromOcrTsv([OCR_HEADER,invalid].join('\n'),{imageWidth:400,imageHeight:200});
 assert.ok(e.issues.some(i=>i.code==='INVALID_OCR_GEOMETRY'));
 assert.ok(e.issues.some(i=>i.code==='INVALID_OCR_CONFIDENCE'));
});
test('OCR cannot run without image dimensions or word metadata',()=>{
 assert.throws(()=>evidenceFromOcrTsv('hello'),/OCR_TSV_METADATA_MISSING/);
});
