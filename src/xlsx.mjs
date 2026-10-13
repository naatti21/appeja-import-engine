/**
 * XLSX OOXML read-only subset. No uploads, eval, external links or macros.
 * Retains cell/sheet provenance; refuses unsupported workbook structures.
 * Deflate data is decoded locally by browser DecompressionStream or an injected inflater.
 */
const utf8=new TextDecoder('utf-8',{fatal:true});
const u16=(b,o)=>b[o]|b[o+1]<<8;
const u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
const MAX_ENTRIES=300,MAX_FILE=5*1024*1024,MAX_TOTAL=15*1024*1024;
export function crc32(bytes){
 let crc=0xffffffff;
 for(const x of bytes){crc^=x;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
 return (crc^0xffffffff)>>>0;
}
function decodeEntities(s){
 return String(s).replace(/&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,(m,v)=>{
  if(v==='amp')return '&';if(v==='lt')return '<';if(v==='gt')return '>';
  if(v==='quot')return '"';if(v==='apos')return "'";
  if(v[0]==='#')return String.fromCodePoint(v[1]?.toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10));
  return m;
 });
}
const attr=(s,key)=>{const m=s.match(new RegExp('(?:^|\\s)'+key.replace(':','\\:')+'\\s*=\\s*(["\\x27])(.*?)\\1'));return m?decodeEntities(m[2]):null;};
async function inflate(data,fn){
 if(fn)return new Uint8Array(await fn(data));
 if(typeof DecompressionStream==='undefined')throw new Error('DEFLATE_NOT_AVAILABLE');
 const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function zipEntries(bytes,inflateRaw){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(b.length<22)throw new Error('INVALID_ZIP');
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)
  if(u32(b,i)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('ZIP_END_NOT_FOUND');
 const count=u16(b,end+10),size=u32(b,end+12),offset=u32(b,end+16);
 if(count>MAX_ENTRIES||count!==u16(b,end+8)||offset+size>b.length)throw new Error('ZIP_UNSUPPORTED_OR_TOO_LARGE');
 let pos=offset,total=0;
 const contents=new Map();
 for(let i=0;i<count;i++){
  if(u32(b,pos)!==0x02014b50)throw new Error('BAD_ZIP_CENTRAL');
  const flags=u16(b,pos+8),method=u16(b,pos+10),checksum=u32(b,pos+16);
  const compressed=u32(b,pos+20),uncompressed=u32(b,pos+24);
  const fnlen=u16(b,pos+28),extra=u16(b,pos+30),comment=u16(b,pos+32),loc=u32(b,pos+42);
  if(flags&1||![0,8].includes(method)||compressed===0xffffffff||uncompressed===0xffffffff)
   throw new Error('UNSUPPORTED_ZIP_ENTRY');
  if(compressed>MAX_FILE||uncompressed>MAX_FILE||total+uncompressed>MAX_TOTAL)
   throw new Error('ZIP_SIZE_LIMIT');
  if(pos+46+fnlen+extra+comment>b.length)throw new Error('ZIP_BOUNDS');
  const name=utf8.decode(b.subarray(pos+46,pos+46+fnlen));
  pos+=46+fnlen+extra+comment;
  if(name.startsWith('/')||name.includes('..')||name.includes('\\')||contents.has(name))
   throw new Error('UNSAFE_ZIP_PATH');
  if(u32(b,loc)!==0x04034b50)throw new Error('MISSING_ZIP_LOCAL');
  const localLen=u16(b,loc+26),localExtra=u16(b,loc+28);
  const start=loc+30+localLen+localExtra;
  if(start+compressed>b.length)throw new Error('ZIP_LOCAL_BOUNDS');
  const payload=b.subarray(start,start+compressed);
  const content=method===0?payload:new Uint8Array(await inflate(payload,inflateRaw));
  if(content.length!==uncompressed||crc32(content)!==checksum)throw new Error('ZIP_INTEGRITY_FAILURE');
  total+=content.length;
  contents.set(name,content);
 }
 return contents;
}
const decodeXml=b=>{if(!b)throw new Error('MISSING_OOXML_PART');return utf8.decode(b);};
function getElements(xml,tag){
 const out=[];
 const re=new RegExp('<(?:[\\w-]+:)?'+tag+'\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+tag+'\\s*>)','gi');
 for(const m of xml.matchAll(re))out.push({attrs:m[1],inner:m[2]??''});
 return out;
}
function innerText(xml){
 return getElements(xml,'t').map(el=>decodeEntities(el.inner)).join('');
}
function colNumber(ref){
 const m=String(ref).match(/^([A-Z]+)(\d+)$/);
 if(!m)return null;
 let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;
 return {column:n,row:Number(m[2])};
}
export async function parseXlsx(bytes,{inflateRaw}={}){
 const files=await zipEntries(bytes,inflateRaw);
 for(const name of files.keys()){
  if(/(?:^|\/)(?:vbaProject\.bin|externalLinks\/|embeddings\/)/i.test(name))
   throw new Error('ACTIVE_OR_EXTERNAL_XLSX_UNSUPPORTED');
 }
 const wb=decodeXml(files.get('xl/workbook.xml'));
 const rel=decodeXml(files.get('xl/_rels/workbook.xml.rels'));
 const rels=new Map(getElements(rel,'Relationship').map(e=>[attr(e.attrs,'Id'),attr(e.attrs,'Target')]));
 const shared=files.has('xl/sharedStrings.xml')
  ?getElements(decodeXml(files.get('xl/sharedStrings.xml')),'si').map(s=>innerText(s.inner)):[];
 const observations=[],sheets=[],issues=[];
 const sheetsMeta=getElements(wb,'sheet');
 if(!sheetsMeta.length)throw new Error('NO_WORKSHEETS');
 for(let si=0;si<sheetsMeta.length;si++){
  const meta=sheetsMeta[si],sheetName=attr(meta.attrs,'name');
  const id=attr(meta.attrs,'r:id');
  const target=rels.get(id);
  if(!sheetName||!target||/^(?:https?:|file:)/i.test(target))throw new Error('UNRESOLVED_SHEET_RELATION');
  const path=target.startsWith('/')?target.slice(1):
    target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,'');
  if(!path.startsWith('xl/worksheets/'))throw new Error('UNSUPPORTED_WORKSHEET_TARGET');
  const xml=decodeXml(files.get(path));
  if(/<(?:\w+:)?(?:mergeCells|pivotTableParts|tableParts)\b/i.test(xml))
   issues.push({code:'STRUCTURAL_SPREADSHEET_FEATURE',sheet:sheetName,level:'blocking'});
  const rows=[],seenCells=new Set();
  for(const row of getElements(xml,'row')){
   const rowNum=Number(attr(row.attrs,'r'));
   if(!Number.isInteger(rowNum)||rowNum<1||rowNum>100000)throw new Error('INVALID_ROW_REF');
   const cells=[];
   for(const cell of getElements(row.inner,'c')){
    const address=attr(cell.attrs,'r'),pos=colNumber(address);
    if(!pos||pos.row!==rowNum||pos.column>16384||seenCells.has(address))
     throw new Error('INVALID_OR_DUPLICATE_CELL_REF');
    seenCells.add(address);
    const kind=attr(cell.attrs,'t')??'n';
    const isFormula=/<(?:\w+:)?f(?:\s|>)/.test(cell.inner);
    const val=getElements(cell.inner,'v')[0]?.inner??null;
    let raw=null;
    if(kind==='s'){
     const idx=Number(val);
     if(!Number.isInteger(idx)||idx<0||idx>=shared.length)throw new Error('INVALID_SHARED_STRING_REF');
     raw=shared[idx];
    }else if(kind==='inlineStr')raw=innerText(cell.inner);
    else if(['n','str','b'].includes(kind))raw=val===null?'':decodeEntities(val);
    else {raw=val===null?'':decodeEntities(val);issues.push({code:'UNSUPPORTED_CELL_TYPE',sheet:sheetName,cell:address,level:'blocking'});}
    if(isFormula)issues.push({code:'FORMULA_VALUE_UNVERIFIED',sheet:sheetName,cell:address,level:'blocking'});
    if(attr(cell.attrs,'s')!==null)issues.push({code:'STYLED_CELL_REVIEW',sheet:sheetName,cell:address,level:'blocking'});
    const observation={id:'xlsx-s'+(si+1)+'-'+address,kind:'cell',raw,
      sheet:sheetName,row:rowNum,column:pos.column,address,method:'xlsx-cell',
      cellType:kind,formula:isFormula,status:'observed',ocrConfidence:null,box:null};
    observations.push(observation);
    cells.push(observation);
   }
   rows.push({row:rowNum,cells});
  }
  sheets.push({name:sheetName,index:si+1,rows});
 }
 return {schemaVersion:1,sourceKind:'xlsx',sheets,observations,issues};
}
export function xlsxSheetToHoldingsTable(document,sheetName){
 const sheet=document.sheets.find(s=>s.name===sheetName);
 if(!sheet)throw new Error('SHEET_NOT_FOUND');
 if(!sheet.rows.length)throw new Error('SHEET_EMPTY');
 const maxColumn=Math.max(...sheet.rows.flatMap(r=>r.cells.map(c=>c.column)),0);
 if(maxColumn>256)throw new Error('TOO_MANY_COLUMNS');
 const normalized=sheet.rows.map(r=>{
  const values=Array(maxColumn).fill('');
  for(const cell of r.cells)values[cell.column-1]=cell.raw;
  return {sourceLine:r.row,values};
 });
 return {schemaVersion:1,sourceKind:'xlsx',rows:normalized,
   observations:document.observations.filter(o=>o.sheet===sheetName),
   issues:[...document.issues]};
}
