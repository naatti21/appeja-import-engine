import {parseHoldingsCsv} from '../src/holdings.mjs';
import {evidenceFromDelimited,evidenceFromPdfLayout,evidenceFromOcrTsv,evidenceFromXlsx} from '../src/import-observations.mjs';
import {parseXlsx,xlsxSheetToHoldingsTable} from '../src/xlsx.mjs';
import {parsePayrollSections} from '../src/payroll-sections.mjs';
import {readPdfWithPdfJs} from '../src/layout.mjs';
const $=id=>document.getElementById(id);
const fileInput=$('sourceFile'),status=$('status'),error=$('error'),results=$('results');
const MAX_SIZE=10*1024*1024;
const payslipNames={payDate:'Maksupäivä',grossPay:'Bruttotulo',netPay:'Nettopalkka',ytdTaxableIncome:'Veronalainen kertymä',withholdingPeriod:'Ennakonpidätys kaudella',withholdingYtd:'Ennakonpidätys vuoden alusta'};
let previewUrl=null,working=false,ocrLoader=null;
function el(tag,content,cls=''){
 const e=document.createElement(tag);e.textContent=String(content??'');e.className=cls;return e;
}
function clearPrevious(){
 results.hidden=true;error.hidden=true;error.textContent='';
 $('candidates').replaceChildren();$('issues').replaceChildren();$('evidenceRows').replaceChildren();
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 $('preview').removeAttribute('src');$('preview').style.display='none';
}
function addCandidate(title,fields){
 const box=el('div','','item'),head=el('h3',title),dl=document.createElement('dl');
 for(const [label,value] of fields){dl.append(el('dt',label),el('dd',value??'Puuttuu'));}
 box.append(head,dl);$('candidates').append(box);
}
function renderReport(report){
 $('formatText').textContent=report.format;
 $('observationCount').textContent=String(report.observations.length);
 $('issueCount').textContent=String(report.issues.length);
 $('summary').textContent=report.summary;
 $('candidates').replaceChildren();$('issues').replaceChildren();$('evidenceRows').replaceChildren();
 for(const c of report.candidates??[])addCandidate(c.name,c.fields);
 if(!(report.candidates??[]).length)addCandidate('Vain havaintoja', [['Tila','Dokumentin semantiikka ei ole varmennettu']]);
 for(const problem of report.issues.slice(0,18))
  $('issues').append(el('div',problem.code+(problem.field?' · '+problem.field:''),'item warning'));
 if(!report.issues.length)$('issues').append(el('div','Kaikki tulokset vaativat käyttäjän tarkistuksen. LAB ei tallenna mitään.','item'));
 if(report.issues.length>18)
  $('issues').append(el('div','Lisäksi '+(report.issues.length-18)+' muuta tarkistettavaa havaintoa.','item'));
 for(const o of report.observations.slice(0,350)){
  const source=o.source??{},tr=document.createElement('tr');
  let label=source.sheet?source.sheet+'!'+source.address:
   source.format==='pdf'?'sivu '+source.page+' · '+o.id:
   source.format==='image-ocr'?'OCR rivi '+source.line+' · '+o.id:
   source.row?'R'+source.row+' C'+source.column:o.id;
  tr.append(el('td',label),el('td',o.raw));$('evidenceRows').append(tr);
 }
 if(report.observations.length>350)
  $('issues').append(el('div','Taulukossa näytetään vain ensimmäiset 350 havaintoa. Kaikkia ei ole arvioitu.','item warning'));
 $('previewCard').hidden=!report.image;
 results.hidden=false;
}
const holdingEntries=(parsed,sourceKind,sourceDoc=null,tabName=null)=>{
 const out=[];
 for(let row=0;row<parsed.records.length;row++){
  const rec=parsed.records[row],fs=rec.fields;
  const val=key=>fs[key]?.status==='valid'?fs[key].value:'Puuttuu / epäselvä';
  const origin=key=>{
   const id=fs[key]?.observationId;
   if(!id)return 'ei lähdettä';
   if(sourceKind!=='xlsx')return id;
   const col=Number(id.match(/-c(\d+)$/)?.[1]);
   return sourceDoc?.observations?.find(o=>o.sheet===tabName&&o.row===row+2&&o.column===col)?.id??'ei lähdettä';
  };
  out.push({name:String(val('ticker')!=='Puuttuu / epäselvä'?val('ticker'):val('name')),
   fields:[['Yhtiö',val('name')],['Määrä',val('quantity')],['Hankintahinta',val('buyPrice')],
    ['Valuutta',val('currency')],['Määrän lähde',origin('quantity')],
    ['Hankintahinnan lähde',origin('buyPrice')],
    ['Tila',rec.issues.map(x=>x.code).join(', ')||'Vaatii käyttäjän hyväksynnän']]});
 }
 return out;
};
async function handleText(file){
 const txt=await file.text();
 const evidence=evidenceFromDelimited(txt),parsed=parseHoldingsCsv(txt);
 const issues=[...evidence.issues,...parsed.issues,...parsed.records.flatMap(r=>r.issues)];
 renderReport({format:'CSV/TSV',observations:evidence.observations,issues,
  candidates:holdingEntries(parsed,'csv'),
  summary:'Sarakkeet ja omistusehdokkaat luettu. Puuttuva ostohinta, valuutta tai instrumenttitunnus estää automaattisen hyväksynnän.'});
}
async function handleWorkbook(file){
 const bytes=new Uint8Array(await file.arrayBuffer());
 const workbook=await parseXlsx(bytes),evidence=await evidenceFromXlsx(bytes);
 let selected=null,parsed=null;
 for(const sh of workbook.sheets){
  try{
   const test=parseHoldingsCsv(xlsxSheetToHoldingsTable(workbook,sh.name));
   if(test.records.length&&!test.issues.some(x=>x.code==='REQUIRED_HEADERS_MISSING')){
    selected=sh.name;parsed=test;break;
   }
  }catch{}
 }
 const issues=[...evidence.issues];
 if(workbook.sheets.length>1)issues.push({code:'MULTIPLE_SHEETS_REVIEW'});
 if(!parsed)issues.push({code:'NO_HOLDINGS_SHEET_MATCH'});
 else issues.push(...parsed.issues,...parsed.records.flatMap(r=>r.issues));
 renderReport({format:'XLSX',observations:evidence.observations,issues,
  candidates:parsed?holdingEntries(parsed,'xlsx',workbook,selected):[],
  summary:'Välilehtiä '+workbook.sheets.length+'. Luettu ehdokasvälilehti: '+(selected??'ei tunnistettu')+'. Kaavat ja muut välilehdet vaativat tarkistuksen.'});
}
async function handlePdf(file){
 const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.min.mjs';
 const layout=await readPdfWithPdfJs(pdfjs,new Uint8Array(await file.arrayBuffer()));
 const evidence=evidenceFromPdfLayout(layout);
 const isPayslip=/palkkalaskelma|palkkaerittely|palkanmaksun\s+yhteenveto/i.test(layout.observations.slice(0,85).map(x=>x.raw).join(' '));
 let candidates=[],issues=[...evidence.issues];
 if(isPayslip){
  const data=parsePayrollSections(layout);
  candidates=[{name:'Palkkalaskelman kenttäehdokkaat',fields:Object.entries(payslipNames).map(([key,label])=>{
   const f=data.fields[key];
   return [label,f?.status==='verified'?String(f.value)+' · lähde: '+f.sourceIds.join(', '):
     f?.status==='conflict'?'RISTIRIITA':'Ei vahvistettua arvoa'];
  })}];
  issues.push(...data.issues,...data.decision.problems);
 }else issues.push({code:'DOCUMENT_TYPE_NOT_INTERPRETED'});
 renderReport({format:'PDF',observations:evidence.observations,issues,candidates,
  summary:'PDF-sivuja '+layout.pages.length+'. Tekstihavaintoja '+evidence.observations.length+'. '+(isPayslip?'Palkkakentät ovat tarkistettavia ehdokkaita.':'Dokumentin arvoja ei ole kohdistettu mihinkään sovellukseen.')});
}
function loadTesseract(){
 if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
 if(ocrLoader)return ocrLoader;
 ocrLoader=new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;
  s.crossOrigin='anonymous';
  s.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('Tesseract ei käynnistynyt'));
  s.onerror=()=>reject(new Error('Oman palvelimen OCR-pakettia ei ole asennettu: käsittely keskeytetään.'));
  document.head.append(s);
 }).catch(err=>{ocrLoader=null;throw err;});
 return ocrLoader;
}
async function handleImage(file){
 previewUrl=URL.createObjectURL(file);
 $('preview').src=previewUrl;$('preview').style.display='block';
 const bitmap=await createImageBitmap(file),imageWidth=bitmap.width,imageHeight=bitmap.height;
 bitmap.close();
 const api=await loadTesseract();
 let worker=null;
 try{
  worker=await api.createWorker(['fin','eng'],1,{
   workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,
   corePath:new URL('./vendor/ocr/core',import.meta.url).href,
   langPath:new URL('./vendor/ocr/lang',import.meta.url).href,
   gzip:false,workerBlobURL:false,cacheMethod:'none',
   logger:progress=>{
   if(progress.progress!=null)status.textContent='OCR käsittelee kuvaa: '+Math.round(progress.progress*100)+' %';
  }});
  const recognized=await worker.recognize(file,{}, {text:true,tsv:true});
  const tsv=String(recognized?.data?.tsv??'');
  if(!tsv.trim())throw new Error('OCR_TSV_MISSING_FORMAT: '+Object.keys(recognized?.data??{}).join(','));
  if(!tsv.trim().startsWith('level')){
   throw new Error('OCR_TSV_BAD_HEADER: '+tsv.slice(0,120).replace(/\s/g,' '));
  }
  const evidence=evidenceFromOcrTsv(tsv,{imageWidth,imageHeight});
  const grouped=new Map();
  for(const word of evidence.observations){
   const key=word.source.page+':'+word.source.line;
   if(!grouped.has(key))grouped.set(key,[]);
   grouped.get(key).push(word);
  }
  const candidates=[...grouped.values()].slice(0,65).map((words,i)=>{
   words.sort((a,b)=>a.source.box.x0-b.source.box.x0);
   return {name:'OCR-tekstirivi '+(i+1)+' · ei hyväksytty omistus',
    fields:[['Teksti',words.map(o=>o.raw).join(' ')],
    ['Sanatodisteet',words.map(o=>o.id).join(', ')],
    ['Tila','Numerot ja sarakeroolit vaativat erillisen tarkistuksen']]};
  });
  renderReport({format:'Kuva/OCR',observations:evidence.observations,
   issues:[...evidence.issues,{code:'OCR_NOT_SEMANTICALLY_VERIFIED'},{code:'OCR_DECIMAL_PUNCTUATION_RISK'}],
   candidates,image:true,
   summary:'OCR sanoja '+evidence.observations.length+', tekstirivejä '+grouped.size+'. Kuvaa ei tulkita valmiiksi salkuksi eikä ostohintoja päätellä.'});
 }finally{await worker?.terminate();}
}
function reset(){
 clearPrevious();fileInput.value='';$('analyzeBtn').disabled=true;status.textContent='Odottamassa tiedostoa.';
}
fileInput.addEventListener('change',()=>{
 $('analyzeBtn').disabled=!fileInput.files?.length;
 status.textContent=fileInput.files?.length?'Tiedosto valittu. Käynnistä analyysi.':'Odottamassa tiedostoa.';
});
$('clearBtn').addEventListener('click',()=>{if(!working)reset();});
$('analyzeBtn').addEventListener('click',async()=>{
 if(working||!fileInput.files?.length)return;
 const file=fileInput.files[0];
 clearPrevious();
 if(!file.size||file.size>MAX_SIZE){
  error.textContent='Vain 1–10 Mt tiedostot ovat sallittuja.';error.hidden=false;return;
 }
 working=true;$('analyzeBtn').disabled=true;$('clearBtn').disabled=true;
 status.textContent='Tiedostoa käsitellään paikallisesti…';
 try{
  const ext=file.name.toLowerCase().split('.').pop();
  if(['png','jpg','jpeg','webp'].includes(ext))await handleImage(file);
  else if(ext==='pdf')await handlePdf(file);
  else if(ext==='xlsx')await handleWorkbook(file);
  else if(['csv','tsv','txt'].includes(ext))await handleText(file);
  else throw new Error('Tiedostomuoto ei ole tuettu');
  status.textContent='Esitarkistus valmis. Mitään ei tallennettu.';
 }catch(e){
  error.textContent='Lukeminen keskeytyi: '+String(e?.message??'Tuntematon virhe');
  error.hidden=false;status.textContent='Esitarkistusta ei saatu valmiiksi; mitään ei tallennettu.';
 }finally{working=false;$('analyzeBtn').disabled=false;$('clearBtn').disabled=false;}
});