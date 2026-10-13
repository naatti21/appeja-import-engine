/** Generate genuine DEFLATE-compressed synthetic OOXML files in tests. */
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../../src/xlsx.mjs';
const enc=new TextEncoder();
const u16=n=>[n&255,(n>>>8)&255];
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
function join(parts){return Uint8Array.from(parts.flatMap(b=>[...b]));}
const x=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const column=n=>{let s='';for(let k=n;k>0;k=Math.floor((k-1)/26))s=String.fromCharCode(65+(k-1)%26)+s;return s;};
export function zipTestFiles(files,{compress=true}={}){
 const locals=[],centrals=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const raw=enc.encode(text),data=compress?new Uint8Array(deflateRawSync(raw)):raw;
  const fn=enc.encode(name);
  const crc=crc32(raw);
  const local=join([[0x50,0x4b,3,4],u16(20),u16(0),u16(compress?8:0),u16(0),u16(0),
   u32(crc),u32(data.length),u32(raw.length),u16(fn.length),u16(0),fn,data]);
  const central=join([[0x50,0x4b,1,2],u16(20),u16(20),u16(0),u16(compress?8:0),u16(0),u16(0),
   u32(crc),u32(data.length),u32(raw.length),u16(fn.length),u16(0),u16(0),u16(0),
   u16(0),u32(0),u32(offset),fn]);
  locals.push(local);centrals.push(central);offset+=local.length;
 }
 const dir=join(centrals);
 const footer=join([[0x50,0x4b,5,6],u16(0),u16(0),u16(centrals.length),u16(centrals.length),
  u32(dir.length),u32(offset),u16(0)]);
 return join([...locals,dir,footer]);
}
function worksheet(rows,sharedMap,{formula=false}={}){
 const body=rows.map((row,r)=>{
  const cells=row.map((v,c)=>{
   const address=column(c+1)+(r+1);
   if(v===null||v===undefined)return '';
   if(typeof v==='number')
    return '<c r="'+address+'"><v>'+v+'</v></c>';
   if(typeof v==='object'&&v.formula)
    return '<c r="'+address+'"><f>'+x(v.formula)+'</f><v>'+v.cached+'</v></c>';
   const text=String(v);
   const pos=sharedMap.get(text);
   return '<c r="'+address+'" t="s"><v>'+pos+'</v></c>';
  }).join('');
  return '<row r="'+(r+1)+'">'+cells+'</row>';
 }).join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<sheetData>'+body+'</sheetData></worksheet>';
}
export function syntheticHoldingsXlsx({formula=false,duplicate=false,extra=false,compress=true,portfolioRows=null}={}){
 const defaults=[
  ['Ticker','Name','Quantity','Buy Price','Currency'],
  ['NOKIA','Nokia',10,3.5,'EUR'],
  ['MSFT','Microsoft',2,formula?{formula:'100*4',cached:400}:400,'USD']
 ];
 const rows=portfolioRows?portfolioRows.map(r=>[...r]):defaults;
 if(extra)rows[2].push('Ignored material');
 const other=[['Note','Value'],['Source','Synthetic only']];
 const unique=new Set([...rows,...other].flat().filter(v=>typeof v==='string'));
 const strings=[...unique],mapping=new Map(strings.map((v,i)=>[v,i]));
 const shared='<?xml version="1.0" encoding="UTF-8"?>'+
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+strings.length+
  '" uniqueCount="'+strings.length+'">'+strings.map(v=>'<si><t>'+x(v)+'</t></si>').join('')+'</sst>';
 const wb='<?xml version="1.0" encoding="UTF-8"?>'+
 '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
 '<sheets><sheet name="Salkku" sheetId="1" r:id="rId1"/>'+
 '<sheet name="Meta" sheetId="2" r:id="rId2"/></sheets></workbook>';
 const rel='<?xml version="1.0" encoding="UTF-8"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
 '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>';
 const files={
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  'xl/workbook.xml':wb,
  'xl/_rels/workbook.xml.rels':rel,
  'xl/sharedStrings.xml':shared,
  'xl/worksheets/sheet1.xml':worksheet(rows,mapping),
  'xl/worksheets/sheet2.xml':worksheet(other,mapping)
 };
 return zipTestFiles(files,{compress});
}
