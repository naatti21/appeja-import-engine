/**
 * Stable source evidence envelope across tabular, PDF and image-OCR pipelines.
 * This module does NOT decide what holdings or wages mean; no persistence.
 */
import {parseDelimited} from './csv.mjs';
import {parseXlsx} from './xlsx.mjs';

const cleanRaw=v=>String(v??'');
function makeEvidence(id,raw,source,method,extra={}){
 return {id,raw:cleanRaw(raw),source,method,status:'observed',...extra};
}
const finish=(sourceKind,observations,issues=[],tables=[])=>{
 const seen=new Set();
 for(const o of observations){
  if(seen.has(o.id))throw new Error('DUPLICATE_CANONICAL_OBSERVATION');
  seen.add(o.id);
 }
 return {schemaVersion:1,sourceKind,observations,issues,tables,
   canPersist:false,requiresReview:issues.length>0};
};
export function evidenceFromDelimited(text){
 const csv=parseDelimited(text);
 return finish('delimited-text',csv.observations.map(o=>
  makeEvidence(o.id,o.raw,{format:'delimited-text',row:o.row,column:o.column,line:o.sourceLine},o.method)
 ),csv.issues.map(i=>({level:'blocking',...i})),
 [{name:'main',rows:csv.rows.map(r=>({row:r.sourceLine,values:r.values}))}]);
}
export async function evidenceFromXlsx(bytes,opts={}){
 const excel=await parseXlsx(bytes,opts);
 return finish('xlsx',excel.observations.map(o=>
  makeEvidence(o.id,o.raw,{format:'xlsx',sheet:o.sheet,row:o.row,column:o.column,address:o.address},
   o.method,{cellType:o.cellType,formula:o.formula})
 ),excel.issues,excel.sheets.map(sh=>({
  name:sh.name,rows:sh.rows.map(r=>({row:r.row,cells:r.cells.map(c=>({
   column:c.column,value:c.raw,id:c.id}))}))
 })));
}
export function evidenceFromPdfLayout(layout){
 return finish('pdf',layout.observations.map(o=>
  makeEvidence(o.id,o.raw,{format:'pdf',page:o.page,box:o.box},
   o.method,{ocrConfidence:o.ocrConfidence??null})
 ),(layout.issues??[]).map(i=>({level:'blocking',...i})));
}
/** Input is Tesseract TSV *already extracted from a screenshot*, not pixels. */
export function evidenceFromOcrTsv(tsv,{imageWidth,imageHeight}={}){
 const rows=String(tsv??'').replace(/\r/g,'').split('\n');
 const keys=rows.shift()?.split('\t')??[];
 const needed=['level','text','left','top','width','height','conf','page_num','line_num','word_num'];
 const index=Object.fromEntries(keys.map((key,i)=>[key,i]));
 if(needed.some(k=>index[k]===undefined)||!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||
   imageWidth<=0||imageHeight<=0)throw new Error('OCR_TSV_METADATA_MISSING');
 const observations=[],issues=[];
 for(const row of rows){
  if(!row.trim())continue;
  const cells=row.split('\t');
  if(cells[index.level]!=='5')continue;
  const raw=cells[index.text]??'';
  if(!raw.trim())continue;
  const left=Number(cells[index.left]),top=Number(cells[index.top]);
  const width=Number(cells[index.width]),height=Number(cells[index.height]);
  const confidence=Number(cells[index.conf]);
  const page=Number(cells[index.page_num]),line=Number(cells[index.line_num]);
  const word=Number(cells[index.word_num]);
  const id='ocr-p'+page+'-l'+line+'-w'+word+'-n'+(observations.length+1);
  if([left,top,width,height].some(n=>!Number.isFinite(n))||left<0||top<0||width<=0||height<=0||
    left+width>imageWidth||top+height>imageHeight){
   issues.push({level:'blocking',code:'INVALID_OCR_GEOMETRY',observationId:id});
  }
  if(!Number.isFinite(confidence)||confidence<0||confidence>100)
   issues.push({level:'blocking',code:'INVALID_OCR_CONFIDENCE',observationId:id});
  observations.push(makeEvidence(id,raw,{
   format:'image-ocr',page,box:{x0:left/imageWidth,y0:top/imageHeight,
    x1:(left+width)/imageWidth,y1:(top+height)/imageHeight},line,word
  },'tesseract-tsv',{ocrConfidence:Number.isFinite(confidence)?confidence:null}));
 }
 if(!observations.length)issues.push({level:'blocking',code:'NO_OCR_TEXT'});
 // OCR text confidence cannot certify a security/financial field assignment.
 return {...finish('image-ocr-tsv',observations,issues),requiresReview:true};
}
