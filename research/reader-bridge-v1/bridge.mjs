/** YÖAJO 11: read-only source observation bridge. Never asserts financial semantics. */
import {layoutFromPdfItems} from '../../src/layout.mjs';
import {auditSourceCoverage} from '../source-evidence-v1/gate.mjs';

const required=['level','page_num','block_num','par_num','line_num','word_num','left','top','width','height','conf','text'];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const pos=n=>Number.isInteger(n)&&n>0;
const round=n=>Math.round(n*1e6)/1e6;
const box=b=>b&&['x0','y0','x1','y1'].every(k=>finite(b[k]))&&
  b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
function empty(sourceKind,issue){
  return {schemaVersion:1,sourceKind,observations:[],pages:[],unplacedObservations:[],
    issues:[{code:issue}]};
}

/** Input is the *original* PDF.js getTextContent().items, not Palkka's flattened string. */
export function fromPdfJsTextItems(pages){
  if(typeof pages==='string'||!Array.isArray(pages))return empty('pdf-text','FLATTENED_PDF_TEXT_UNVERIFIABLE');
  try{
    const layout=layoutFromPdfItems(pages);
    for(const o of layout.observations)if(!box(o.box))
      layout.issues.push({code:'SOURCE_GEOMETRY_UNVERIFIED',sourceId:o.id,page:o.page});
    return {...layout,unplacedObservations:[]};
  }catch{
    return empty('pdf-text','INVALID_PDF_ITEMS');
  }
}

/** Raw Tesseract TSV level-5 words, with caller-supplied verified page pixel dimensions.
 * This is a parser for OCR output, NOT an OCR engine. Preserves identical-value occurrences.
 */
export function fromTesseractWordTsv(tsv,pageDimensions){
  const sourceKind='image-ocr-tsv';
  if(typeof tsv!=='string'||!Array.isArray(pageDimensions)||!pageDimensions.length||
    pageDimensions.some(p=>!p||!finite(p.width)||!finite(p.height)||p.width<=0||p.height<=0))
    return empty(sourceKind,'INVALID_OCR_INPUT');
  const rows=tsv.split(/\r?\n/).filter(row=>row.length>0);
  const header=(rows.shift()??'').split('\t');
  if(required.some(key=>header.filter(h=>h===key).length!==1))
    return empty(sourceKind,'INVALID_TSV_HEADER');
  const i=Object.fromEntries(header.map((key,idx)=>[key,idx]));
  const observations=[],issues=[],unplacedObservations=[],seen=new Set();
  for(let row=0;row<rows.length;row++){
    const cells=rows[row].split('\t');
    if(cells.length<header.length){issues.push({code:'TRUNCATED_TSV_ROW',row:row+2});continue;}
    if(cells[i.level]!=='5')continue;
    const raw=cells.slice(i.text).join('\t');
    if(!raw.trim())continue;
    const page=Number(cells[i.page_num]);
    const address=['page_num','block_num','par_num','line_num','word_num'].map(k=>cells[i[k]]).join(':');
    const id='ocr-tsv-r'+(row+2);
    if(seen.has(address))issues.push({code:'DUPLICATE_TSV_WORD_ADDRESS',sourceId:id,address});
    seen.add(address);
    if(!pos(page)||page>pageDimensions.length){
      unplacedObservations.push({id,raw,rawPage:cells[i.page_num],address,method:'tesseract-tsv-word'});
      issues.push({code:'INVALID_OCR_PAGE',sourceId:id});continue;
    }
    const {width:W,height:H}=pageDimensions[page-1];
    const left=Number(cells[i.left]),top=Number(cells[i.top]),w=Number(cells[i.width]),h=Number(cells[i.height]);
    let normalized=null;
    if([left,top,w,h].every(finite)&&w>0&&h>0){
      const b={x0:round(left/W),y0:round(top/H),x1:round((left+w)/W),y1:round((top+h)/H)};
      if(box(b))normalized=b;
    }
    if(!normalized)issues.push({code:'INVALID_OCR_WORD_GEOMETRY',sourceId:id,page});
    const conf=Number(cells[i.conf]);
    observations.push({id,raw,page,box:normalized,kind:'text',method:'tesseract-tsv-word',
      ocrConfidence:finite(conf)&&conf>=0&&conf<=100?conf:null,
      sourceIndex:row+2,sourceAddress:address,status:'observed'});
  }
  const pages=pageDimensions.map((dimensions,k)=>({page:k+1,width:dimensions.width,height:dimensions.height,
    observationIds:observations.filter(o=>o.page===k+1).map(o=>o.id)}));
  return {schemaVersion:1,sourceKind,observations,pages,unplacedObservations,issues};
}

/** Source-only review path: even a successful research gate NEVER grants app acceptance.
 * Verified field claims must be explicitly typed; this bridge cannot infer heading/value roles.
 */
export function inspectReadOnlyHandoff(layout,fields={}){
  if(!layout||!Array.isArray(layout.observations)||!Array.isArray(layout.issues)||
    !Array.isArray(layout.unplacedObservations)||!fields||typeof fields!=='object'||Array.isArray(fields))
    return {status:'review-required',canAutoAccept:false,canPersist:false,
      issues:[{code:'INVALID_READER_BRIDGE'}],audit:null};
  const issues=[...layout.issues];
  if(layout.unplacedObservations.length)issues.push({code:'UNPLACED_SOURCE_OBSERVATIONS'});
  for(const [field,claim]of Object.entries(fields)){
    if(claim?.status==='verified'&&(!claim.sourceRoles||!Array.isArray(claim.sourceRoles.valueIds)||
      !claim.sourceRoles.valueIds.length))
      issues.push({code:'UNTYPED_OR_MISSING_VALUE_CLAIM',field});
  }
  const audit=auditSourceCoverage(layout,{fields,payLines:[],
    decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}});
  return {status:'review-required',canAutoAccept:false,canPersist:false,
    issues:[...issues,...audit.issues],audit,
    evidenceCount:layout.observations.length,
    unplacedCount:layout.unplacedObservations.length};
}
