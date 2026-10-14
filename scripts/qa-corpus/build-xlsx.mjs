/**
 * Local, dependency-free test-only OOXML serializer.
 * Existing LAB fixture ZIP helper supplies DEFLATE, CRC32 and stable ordering.
 * All cells are lexical strings: never reinterpret decimal commas or formulas.
 * This is NOT a spreadsheet editor or production importer.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {zipTestFiles} from '../../tests/fixtures/native-xlsx.mjs';
import {parseXlsx} from '../../src/xlsx.mjs';
import {inflateRawSync} from 'node:zlib';

const root=path.resolve(process.argv[2]??'qa-output/corpus');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
 .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function column(n){
 let out='';
 for(let v=n;v>0;v=Math.floor((v-1)/26))out=String.fromCharCode(65+(v-1)%26)+out;
 return out;
}
function xlsxFromMatrix(matrix){
 if(!Array.isArray(matrix)||matrix.length<2||matrix.length>100||
    matrix.some(row=>!Array.isArray(row)||row.length!==matrix[0].length)||
    matrix[0].length>15)throw new Error('BAD_MATRIX');
 const stringTable=[],stringIndex=new Map();
 for(const row of matrix)for(const value of row){
  const raw=String(value??'');
  if(!stringIndex.has(raw)){stringIndex.set(raw,stringTable.length);stringTable.push(raw);}
 }
 const shared='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'+
 ' count="'+matrix.flat().length+'" uniqueCount="'+stringTable.length+'">'+
 stringTable.map(value=>'<si><t xml:space="preserve">'+esc(value)+'</t></si>').join('')+'</sst>';
 const sheetData=matrix.map((row,r)=>'<row r="'+(r+1)+'">'+
  row.map((value,c)=>'<c r="'+column(c+1)+(r+1)+'" t="s"><v>'+
   stringIndex.get(String(value??''))+'</v></c>').join('')+'</row>').join('');
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<sheetData>'+sheetData+'</sheetData></worksheet>';
 const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'+
 ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
 '<sheets><sheet name="Synthetic" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const wrels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"'+
 ' Target="worksheets/sheet1.xml"/></Relationships>';
 const topRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'+
 ' Target="xl/workbook.xml"/></Relationships>';
 const content='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
 '<Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
 '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
 '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'+
 '</Types>';
 return zipTestFiles({
  '[Content_Types].xml':content,
  '_rels/.rels':topRels,
  'xl/workbook.xml':wb,
  'xl/_rels/workbook.xml.rels':wrels,
  'xl/sharedStrings.xml':shared,
  'xl/worksheets/sheet1.xml':sheet
 });
}
let rows=0,files=0;
for(const entry of manifest){
 const folder=path.join(root,entry.case_id);
 const oracle=JSON.parse(await fs.readFile(path.join(folder,'oracle.json'),'utf8'));
 const contents=xlsxFromMatrix(oracle.matrix);
 const filename=path.join(folder,'source.xlsx');
 await fs.writeFile(filename,contents);
 // Independent LAB OOXML reader verifies every address and exact lexical token.
 const parsed=await parseXlsx(contents,{inflateRaw:data=>inflateRawSync(data)});
 if(parsed.issues.length||parsed.sheets.length!==1||parsed.sheets[0].name!=='Synthetic')
  throw new Error('XLSX_READER_REJECTED '+entry.case_id);
 const observed=parsed.sheets[0].rows.map(row=>row.cells.map(c=>c.raw));
 if(JSON.stringify(observed)!==JSON.stringify(oracle.matrix))
  throw new Error('XLSX_ORACLE_MISMATCH '+entry.case_id);
 rows+=oracle.matrix.length;
 files++;
}
if(files!==60)throw new Error('CORPUS_WRONG_CASE_COUNT: '+files);
console.log('QA_XLSX_GENERATED '+JSON.stringify({
 cases:files,cellsVerified:rows,allLexicalTokensEqualOracle:true,
 generator:'test-only-OOXML',artifactToolOriginalBinaryEquivalent:false
}));
