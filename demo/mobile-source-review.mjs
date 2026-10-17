import {createReviewDraft,correctReviewField,reviewFieldSources,reviewDiagnostics} from '../src/review-draft.mjs';
import {evidenceFromDelimited,evidenceFromPdfLayout,evidenceFromOcrTsv} from '../src/import-observations.mjs';
import {parseHoldingsCsv} from '../src/holdings.mjs';
import {parsePayrollSections} from '../src/payroll-sections.mjs';
import {readPdfWithPdfJs} from '../src/layout.mjs';
import {resolvePositionedHoldings} from '../src/positioned-holdings.mjs';
import {parseNumber} from '../src/numbers.mjs';
import {completePayslipPdf} from './complete-pdf.mjs';

const $=id=>document.getElementById(id);
const labelNames={
  name:'Yhtiö tai instrumentti',ticker:'Tikkeri',isin:'ISIN',currency:'Valuutta',
  quantity:'Kappalemäärä',buyPrice:'Hankintahinta',account:'Tili',accountType:'Tilityyppi',
  broker:'Välittäjä',mic:'Markkinapaikka',row_id:'Rivitunnus',current_price:'Nykykurssi',
  current_value:'Nykyarvo',purchase_price:'Hankintahinta',
  payDate:'Maksupäivä',payPeriodStart:'Palkkakauden alku',payPeriodEnd:'Palkkakauden loppu',
  grossPay:'Bruttopalkka',netPay:'Nettopalkka',ytdTaxableIncome:'Veronalainen kertymä',
  previousYearTaxableIncome:'Edellisen vuoden kertymä',
  withholdingPeriod:'Ennakonpidätys',withholdingYtd:'Ennakonpidätys vuoden alusta',
  text:'OCR-tekstirivi (ei omistus)'
};
const moneyKeys=new Set(['quantity','buyPrice','current_price','current_value','purchase_price',
  'grossPay','netPay','ytdTaxableIncome','previousYearTaxableIncome','withholdingPeriod','withholdingYtd']);
const dateKeys=new Set(['payDate','payPeriodStart','payPeriodEnd']);
const supportedStatuses=new Set(['verified','candidate','missing','ambiguous','conflict','invalid','unverified']);
const MAX_BYTES=10*1024*1024;
let draft=null,operation=0,imageUrl=null,ocrPromise=null;

function node(tag,content,cls=''){
  const el=document.createElement(tag);
  if(content!==undefined)el.textContent=String(content);
  if(cls)el.className=cls;
  return el;
}
function revokeImage(){
  if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}
  $('sourcePreview').removeAttribute('src');$('imagePanel').hidden=true;
}
function cancel(){
  operation++;draft=null;revokeImage();
  $('draftPanel').hidden=true;$('reviewCards').replaceChildren();$('issueItems').replaceChildren();
  $('documentFile').value='';
  $('feedback').textContent='Peruttu. Luonnos ja mahdolliset korjaukset tyhjennetty.';
}
function friendlyField(key){return labelNames[key]||key;}
function fieldStatus(field){
  return field.reviewState==='user-corrected'?'Korjattu käsin':
    field.status==='missing'?'Puuttuu':field.status==='conflict'?'Ristiriita':
    field.status==='ambiguous'?'Epäselvä':field.status==='invalid'?'Virheellinen':
    field.status==='verified'?'Tulkittu lähteestä':'Ehdotus, tarkista';
}
function displayValue(field){
  return field.value==null?'Puuttuu':String(field.value);
}
function correctedValue(key,text){
  const raw=text.trim();
  if(!raw)throw new Error('Tyhjää arvoa ei vahvisteta. Täydennä kenttä.');
  if(moneyKeys.has(key)){
    const n=parseNumber(raw);
    if(n.status!=='valid')throw new Error('Luku on epäselvä. Kirjoita esimerkiksi 12,50.');
    if(key==='quantity' && !(n.value>0))throw new Error('Määrän täytyy olla suurempi kuin nolla.');
    if(key!=='quantity' && n.value<0)throw new Error('Tässä kentässä ei hyväksytä negatiivista lukua.');
    return n.value;
  }
  if(dateKeys.has(key)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('Kirjoita päivämäärä muodossa VVVV-KK-PP.');
    const [y,m,d]=raw.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)
      throw new Error('Päivämäärä ei ole kelvollinen.');
  }
  if(raw.length>180)throw new Error('Kentän pituus ylittää rajan.');
  return raw;
}

function render(){
  if(!draft)return;
  const diag=reviewDiagnostics(draft);
  $('draftSummary').textContent=diag.recordCount+' tietuetta · '+diag.fieldCount+
    ' kenttää · '+diag.correctedCount+' korjausta. Ei tallennusta.';
  const cards=$('reviewCards');cards.replaceChildren();
  for(const record of draft.records){
    const card=node('article',undefined,'card');
    card.append(node('h3',draft.documentType==='payroll'?'Palkkatietojen tarkistus':
      draft.documentType==='holdings'?'Omistusehdotus':'Havaintoehdotus'));
    for(const [key,field] of Object.entries(record.fields)){
      const wrap=node('div',undefined,'field'),head=node('div',friendlyField(key),'field-name');
      const value=node('div',displayValue(field),'field-value');
      const status=node('div',fieldStatus(field),'field-note');
      const detail=document.createElement('details');detail.className='details';
      detail.append(node('summary','Näytä alkuperäinen lähde ('+field.sourceIds.length+')'));
      const origins=reviewFieldSources(draft,record.id,key);
      if(!origins.length)detail.append(node('p','Ei luotettavaa lähdeviitettä.','field-note warn'));
      else for(const origin of origins){
        const area=node('div',undefined,'source-line');
        const s=origin.source||{};
        area.append(node('div',origin.raw),node('small',
          s.format==='pdf'?'PDF · sivu '+s.page:
          s.format==='image-ocr'?'Kuva · sivu '+s.page+' · rivi '+s.line:
          s.row?'Taulukko · rivi '+s.row+' · sarake '+s.column:
          'Havaintotunnus: '+origin.id,'field-note'));
        detail.append(area);
      }
      const input=document.createElement('input');
      input.type='text';input.className='edit-input';input.value=field.value==null?'':String(field.value);
      input.autocomplete='off';input.spellcheck=false;
      input.setAttribute('aria-label',friendlyField(key)+' uusi arvo');
      const action=node('button','Vahvista korjaus','edit-button');
      action.type='button';
      action.setAttribute('aria-label','Vahvista '+friendlyField(key));
      action.addEventListener('click',()=>{
        try{
          const newValue=correctedValue(key,input.value);
          draft=correctReviewField(draft,{recordId:record.id,fieldName:key,value:newValue,confirmed:true});
          $('feedback').textContent='Korjaus tehty vain tähän luonnokseen. Mitään ei tallennettu.';
          render();
        }catch(e){$('feedback').textContent='Korjausta ei hyväksytty: '+String(e.message||e);}
      });
      wrap.append(head,value,status,detail,input,action);card.append(wrap);
    }
    cards.append(card);
  }
  const issues=$('issueItems');issues.replaceChildren();
  for(const issue of draft.problems.slice(0,30))
    issues.append(node('p',String(issue.code||'REVIEW_REQUIRED')+
      (issue.field?' · '+issue.field:''),'warn'));
  if(!draft.problems.length)issues.append(node('p',
    'Ei rakenteellisia estoviestejä, mutta käyttäjän ja sovelluksen oma hyväksyntä puuttuu.','field-note'));
  if(draft.problems.length>30)issues.append(node('p','Lisäksi '+(draft.problems.length-30)+' huomiota.','warn'));
  $('draftPanel').hidden=false;
}
function showDraft(next,token,imageFile=null){
  if(token!==operation)return;
  draft=next;revokeImage();
  if(imageFile){
    imageUrl=URL.createObjectURL(imageFile);
    $('sourcePreview').src=imageUrl;$('imagePanel').hidden=false;
  }
  render();
  $('feedback').textContent='Tarkistusluonnos valmis. Käy ehdotukset läpi tai peru.';
}
function csvDraft(text){
  const source=evidenceFromDelimited(text),parsed=parseHoldingsCsv(text);
  const records=parsed.records.map((r,i)=>({
    id:'salkku-rivi-'+(i+1),
    fields:Object.fromEntries(Object.entries(r.fields).map(([key,f])=>[key,{
      value:f.value,status:f.status==='valid'?'candidate':supportedStatuses.has(f.status)?f.status:'unverified',
      sourceIds:f.observationId?[f.observationId]:[]
    }]))
  }));
  return createReviewDraft({documentType:'holdings',source,records,
    adapterProblems:[...parsed.issues,...parsed.records.flatMap(r=>r.issues)]});
}
async function pdfDraft(bytes){
  const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.min.mjs';
  const layout=await readPdfWithPdfJs(pdfjs,bytes);
  const source=evidenceFromPdfLayout(layout);
  const parsed=parsePayrollSections(layout);
  const fields=Object.fromEntries(Object.entries(parsed.fields).map(([key,f])=>[key,{
    value:f.value,status:supportedStatuses.has(f.status)?f.status:'unverified',
    sourceIds:f.sourceIds||[]
  }]));
  return createReviewDraft({documentType:'payroll',source,
    records:[{id:'palkkalaskelma-1',fields}],
    adapterProblems:[...parsed.issues,...(parsed.decision?.problems||[])]});
}
function loadTesseract(){
  if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
  if(ocrPromise)return ocrPromise;
  ocrPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;
    s.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('OCR ei käynnistynyt'));
    s.onerror=()=>reject(new Error('Paikallista OCR-pakettia ei ole asennettu LABiin.'));
    document.head.append(s);
  }).catch(e=>{ocrPromise=null;throw e;});
  return ocrPromise;
}
async function imageDraft(file,token){
  const bmp=await createImageBitmap(file),imageWidth=bmp.width,imageHeight=bmp.height;bmp.close();
  const tesseract=await loadTesseract();
  let worker;
  try{
    worker=await tesseract.createWorker(['fin','eng'],1,{
      workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,
      corePath:new URL('./vendor/ocr/core',import.meta.url).href,
      langPath:new URL('./vendor/ocr/lang',import.meta.url).href,
      gzip:false,workerBlobURL:false,cacheMethod:'none',
      logger:message=>{
        if(token===operation&&Number.isFinite(message?.progress))
          $('feedback').textContent='Luetaan kuvaa '+Math.round(message.progress*100)+' %';
      }
    });
    const result=await worker.recognize(file,{}, {text:true,tsv:true});
    const source=evidenceFromOcrTsv(String(result?.data?.tsv||''),{imageWidth,imageHeight});
    const positioned=resolvePositionedHoldings(source);
    if(positioned.rows.length){
      const records=positioned.rows.map((r,i)=>({
        id:'kuvarivi-'+(i+1),
        fields:Object.fromEntries(Object.entries(r.fields).map(([key,f])=>[key,{
          value:f.value,status:supportedStatuses.has(f.status)?f.status:'unverified',sourceIds:f.sourceIds||[]
        }]))
      }));
      return createReviewDraft({documentType:'holdings',source,records,
        adapterProblems:[...positioned.problems,{code:'OCR_FIELDS_REQUIRE_VISUAL_REVIEW'}]});
    }
    // No table was identified: show actual OCR lines, never guess holdings or prices.
    const grouped=new Map();
    for(const word of source.observations){
      const id=String(word.source.page)+':'+String(word.source.line);
      if(!grouped.has(id))grouped.set(id,[]);
      grouped.get(id).push(word);
    }
    const records=[...grouped.values()].slice(0,60).map((words,i)=>({
      id:'tekstirivi-'+(i+1),
      fields:{text:{status:'candidate',value:words.map(w=>w.raw).join(' '),sourceIds:words.map(w=>w.id)}}
    }));
    return createReviewDraft({documentType:'ocr-text-only',source,records,
      adapterProblems:[...positioned.problems,{code:'NO_VERIFIED_HOLDINGS_TABLE'}]});
  }finally{await worker?.terminate();}
}
async function run(work,sourceFile=null){
  const token=++operation;draft=null;revokeImage();$('draftPanel').hidden=true;
  $('reviewCards').replaceChildren();$('issueItems').replaceChildren();
  $('feedback').textContent='Käsitellään paikallisesti…';
  try{
    const result=await work();
    showDraft(result,token,sourceFile);
  }catch(e){
    if(token===operation){$('draftPanel').hidden=true;$('feedback').textContent=
      'Tunnistus keskeytyi: '+String(e?.message||e)+'. Mitään ei tallennettu.';}
  }
}
$('sampleHoldings').addEventListener('click',()=>{
  $('kind').value='holdings';
  const text='Nimi;Määrä;Hankintahinta;Valuutta\nAurora Robotics;7;12,50;EUR\nBoreal Materials;19;8,25;EUR';
  run(async()=>csvDraft(text));
});
$('samplePayroll').addEventListener('click',()=>{
  $('kind').value='payroll';
  const text='Palkkalaskelma\nMaksupäivä 17.10.2026\nVeronalainen ansio / kausi 3200,00\nVuoden veronalainen tulo 27200,00\nNettopalkka 2450,00';
  run(async()=>pdfDraft(completePayslipPdf(text)));
});
$('analyze').addEventListener('click',()=>{
  const file=$('documentFile').files?.[0];
  if(!file){$('feedback').textContent='Valitse ensin tiedosto.';return;}
  if(!file.size||file.size>MAX_BYTES){$('feedback').textContent='Tiedosto on tyhjä tai yli 10 Mt.';return;}
  const kind=$('kind').value,ext=file.name.toLowerCase().split('.').pop();
  if(kind==='holdings'&&['csv','tsv','txt'].includes(ext))return run(async()=>csvDraft(await file.text()));
  if(kind==='payroll'&&ext==='pdf')return run(async()=>pdfDraft(new Uint8Array(await file.arrayBuffer())));
  if(kind==='holdings'&&['png','jpg','jpeg','webp'].includes(ext))
    return run(async()=>imageDraft(file,operation),file);
  $('feedback').textContent=kind==='payroll'?
    'Palkan LAB käsittelee tässä vaiheessa vain tekstipohjaisen PDF:n.':
    'Salkun LAB käsittelee kuvat sekä CSV-, TSV- ja TXT-tiedostot.';
});
$('cancel').addEventListener('click',cancel);
