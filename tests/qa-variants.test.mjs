import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {parseHoldingsCsv} from '../src/holdings.mjs';
import {parseXlsx,xlsxSheetToHoldingsTable} from '../src/xlsx.mjs';
import {syntheticHoldingsXlsx} from './fixtures/native-xlsx.mjs';
import {makePortfolioCase,mutatePortfolioCase,NEGATIVE_MODES,QA_SEEDS,QA_CASES} from './qa/generator.mjs';

const expectIssues={
 missingBuyPrice:'BUY_PRICE_MISSING_REVIEW',
 ambiguousBuyPrice:'PRICE_AMBIGUOUS_REVIEW',
 zeroQuantity:'QUANTITY_NOT_VERIFIED',
 negativeQuantity:'QUANTITY_NOT_VERIFIED',
 missingCurrency:'CURRENCY_NOT_VERIFIED',
 badCurrency:'CURRENCY_NOT_VERIFIED',
 duplicateHeader:'DUPLICATE_SEMANTIC_HEADER',
 unknownMaterial:'UNMAPPED_NONEMPTY_CELL',
 inconsistentWidth:'INCONSISTENT_CSV_WIDTH'
};
function codeList(r){return [
 ...r.issues.map(x=>x.code),
 ...r.records.flatMap(x=>x.issues.map(y=>y.code))
];}
function checkOracle(parsed,c){
 assert.equal(parsed.records.length,c.expected.length);
 assert.equal(parsed.issues.length,0,'clean-case document issues');
 assert.equal(parsed.canAutoAccept,true,'clean-case must be candidate-only, never saved');
 assert.equal(parsed.status,'candidate-only');
 for(let i=0;i<c.expected.length;i++){
  const r=parsed.records[i],v=c.expected[i];
  assert.equal(r.issues.length,0,'clean row has no notices');
  for(const [field,value] of Object.entries(v)){
   if(!c.keys.includes(field))continue;
   assert.equal(r.fields[field].value,value,'oracle field '+field);
   assert.equal(r.fields[field].status,'valid','oracle status '+field);
   assert.equal(r.fields[field].observationId.startsWith('csv-r'+(i+2)+'-c'),true,'column source reference');
  }
  if(!c.keys.includes('account'))assert.equal(r.fields.account,undefined,'no guessed account');
  if(!c.keys.includes('broker'))assert.equal(r.fields.broker,undefined,'no guessed broker');
  if(!c.keys.includes('accountType'))assert.equal(r.fields.accountType,undefined,'broker is not account type');
 }
}
function prepareXlsxRows(c){
 return c.rows.map((row,ri)=>row.map((value,ci)=>{
  if(ri>0&&['quantity','buyPrice'].includes(c.keys[ci]))
   return Number(String(value).replace(',','.'));
  return value;
 }));
}
for(const seed of QA_SEEDS){
 test('generated CSV safety oracle — seed '+seed,()=>{
  let valid=0,blocked=0;
  for(let i=0;i<QA_CASES;i++){
   const c=makePortfolioCase(seed,i);
   try{
    const parsed=parseHoldingsCsv(c.csv);
    checkOracle(parsed,c);
    valid++;
    for(const mode of NEGATIVE_MODES){
     const bad=mutatePortfolioCase(c,mode);
     if(bad.expected==='throw'){
      assert.throws(()=>parseHoldingsCsv(bad.csv));
     }else{
      const negative=parseHoldingsCsv(bad.csv);
      assert.equal(negative.canAutoAccept,false,'negative must not be accepted');
      assert.equal(negative.status,'review-required','negative status');
      assert.ok(codeList(negative).includes(expectIssues[mode]),
       'expected blocker '+expectIssues[mode]+' got '+codeList(negative).join(','));
     }
     blocked++;
    }
   }catch(e){
    throw new Error('REPLAY: QA_SEEDS='+seed+' QA_CASES='+(i+1)+
     ' case='+c.id+' delimiter='+JSON.stringify(c.delimiter)+
     ' headers='+JSON.stringify(c.labels)+
     ' status='+e.message,{cause:e});
   }
  }
  console.log('QA_ORACLE_CSV '+JSON.stringify({seed,valid,negativeBlocked:blocked,
   mutationTypes:NEGATIVE_MODES.length,files:valid+blocked}));
 });
 test('generated native XLSX/CSV independent money oracle — seed '+seed,async()=>{
  let workbooks=0,rowsTotal=0,negative=0;
  for(let i=0;i<QA_CASES;i+=4){
   const c=makePortfolioCase(seed,i);
   const rows=prepareXlsxRows(c);
   for(const compress of [false,true]){
    try{
     const native=syntheticHoldingsXlsx({portfolioRows:rows,compress});
     const parsed=await parseXlsx(native,{inflateRaw:d=>inflateRawSync(d)});
     assert.equal(parsed.sheets.length,2);
     assert.equal(parsed.issues.length,0,'native spreadsheet has no unsupported features');
     const table=xlsxSheetToHoldingsTable(parsed,'Salkku');
     const stocks=parseHoldingsCsv(table);
     checkOracle(stocks,c);
     assert.equal(table.rows.length,rows.length);
     for(let r=1;r<rows.length;r++)for(let column=1;column<=c.keys.length;column++){
      const sheetCell=parsed.observations.find(o=>o.sheet==='Salkku'&&o.row===r+1&&o.column===column);
      assert.ok(sheetCell,'every populated XLSX cell has position');
      assert.ok(sheetCell.id.startsWith('xlsx-s1-'),'source token retained');
     }
     rowsTotal+=c.expected.length;
     workbooks++;
     // Reject corruption inside the first ZIP local file contents.
     const broken=native.slice();
     const firstPart=30+new TextEncoder().encode('[Content_Types].xml').length+3;
     broken[firstPart]^=0x04;
     await assert.rejects(()=>parseXlsx(broken,{inflateRaw:d=>inflateRawSync(d)}));
     negative++;
    }catch(e){
     throw new Error('REPLAY XLSX QA_SEEDS='+seed+' index='+i+' compress='+compress+
      ' case='+c.id+' cause='+e.message,{cause:e});
    }
   }
  }
  console.log('QA_ORACLE_XLSX '+JSON.stringify({seed,realWorkbooks:workbooks,
   oracleRows:rowsTotal,corruptZipRejected:negative}));
 });
}
