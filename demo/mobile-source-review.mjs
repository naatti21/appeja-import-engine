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
let draft=null,operation=0,imageUrl=null,ocrPromise=null,allHoldingsShown=false;

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
  operation++;draft=null;allHoldingsShown=false;revokeImage();
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

function valueFor(record,key){
  const field=record.fields[key];
  return field?displayValue(field):'Ei tiedossa';
}
function summaryCell(record,key){
  const e=node('div',undefined,'summary-cell');
  e.append(node('small',friendlyField(key),'tiny'),
    node('strong',valueFor(record,key),'summary-value'));
  return e;
}
function detailField(record,key,field){
  const row=node('div',undefined,'field compact-field');
  row.dataset.field=key;
  row.dataset.recordId=record.id;
  const head=node('div',undefined,'field-heading');
  const about=node('div');
  about.append(node('span',friendlyField(key),'field-name'),node('div',displayValue(field),'field-value'),
    node('small',fieldStatus(field),'field-note'));
  const edit=node('button','Korjaa','mini-button');
  edit.type='button';edit.setAttribute('aria-label','Korjaa '+friendlyField(key));
  head.append(about,edit);row.append(head);
  const detail=document.createElement('details');
  detail.className='details evidence-toggle';
  detail.append(node('summary','Näytä lähde ('+field.sourceIds.length+')'));
  const origins=reviewFieldSources(draft,record.id,key);
  if(!origins.length)detail.append(node('p','Lähdettä ei voitu varmistaa.','field-note warn'));
  else {
    for(const origin of origins.slice(0,8)){
      const area=node('div',undefined,'source-line'),source=origin.source||{};
      const caption=source.format==='pdf'?'PDF, sivu '+source.page:
        source.format==='image-ocr'?'Kuva, rivi '+source.line:
        source.row?'Rivi '+source.row+', sarake '+source.column:'Lähde '+origin.id;
      area.append(node('div',origin.raw),node('small',caption,'field-note'));
      detail.append(area);
    }
    if(origins.length>8)detail.append(node('p','Lisää lähdehavaintoja '+(origins.length-8),'tiny'));
  }
  row.append(detail);
  const editor=node('div',undefined,'inline-editor');
  editor.hidden=true;row.append(editor);
  edit.addEventListener('click',()=>{
    edit.hidden=true;editor.hidden=false;
    const form=document.createElement('form');
    const label=node('label','Korjaa '+friendlyField(key));
    const input=document.createElement('input');
    input.type='text';input.className='edit-input';
    input.value=field.value==null?'':String(field.value);
    input.autocomplete='off';input.spellcheck=false;
    input.setAttribute('aria-label',friendlyField(key)+' uusi arvo');
    const actions=node('div',undefined,'row edit-actions');
    const confirm=node('button','Vahvista','primary mini-button');
    confirm.type='submit';
    confirm.setAttribute('aria-label','Vahvista '+friendlyField(key));
    const exit=node('button','Peruuta korjaus','mini-button');
    exit.type='button';
    exit.addEventListener('click',()=>{editor.replaceChildren();editor.hidden=true;edit.hidden=false;});
    actions.append(confirm,exit);
    form.append(label,input,actions);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      try{
        const newValue=correctedValue(key,input.value);
        draft=correctReviewField(draft,{
          recordId:record.id,fieldName:key,value:newValue,confirmed:true
        });
        $('feedback').textContent='Korjaus pysyy vain luonnoksessa. Mitään ei tallennettu.';
        render();
      }catch(error){
        $('feedback').textContent='Korjaus epäonnistui: '+String(error.message||error);
      }
    });
    editor.replaceChildren(form);
    input.focus();
  });
  return row;
}
function addDomainCard(host,record,isPayroll,index){
  const card=node('article',undefined,'card review-card');
  const title=isPayroll?'Palkkalaskelma':
    valueFor(record,'name')!=='Ei tiedossa'?valueFor(record,'name'):
    valueFor(record,'ticker')!=='Ei tiedossa'?valueFor(record,'ticker'):'Omistus '+(index+1);
  card.append(node('h3',title));
  const headline=node('div',undefined,'summary-grid');
  const keys=isPayroll?['payDate','grossPay','netPay','ytdTaxableIncome']:
    ['quantity','buyPrice','currency'];
  for(const key of keys)headline.append(summaryCell(record,key));
  card.append(headline);
  const fields=Object.entries(record.fields);
  const uncertainties=fields.filter(([,f])=>f.status==='missing'||f.status==='ambiguous'
    ||f.status==='invalid'||f.status==='conflict'||f.status==='unverified');
  if(uncertainties.length)card.append(node('p',uncertainties.length+
    ' kenttää jäi epäselväksi. Avaa tarvittaessa tarkistus.','tiny warn'));
  const detail=document.createElement('details');
  detail.className='record-details';
  detail.append(node('summary','Tarkista tai korjaa tietoja'));
  const editorContainer=node('div',undefined,'all-fields');
  // Human-readable core fields first; technical metadata follows.
  const ordered=isPayroll?
    ['payDate','grossPay','netPay','ytdTaxableIncome','withholdingPeriod','withholdingYtd',
     'payPeriodStart','payPeriodEnd','previousYearTaxableIncome']:
    ['name','ticker','quantity','buyPrice','currency','account','accountType','broker','isin','mic',
     'row_id','current_price','current_value','purchase_price'];
  const visited=new Set();
  for(const key of ordered){
    if(record.fields[key]){
      editorContainer.append(detailField(record,key,record.fields[key]));visited.add(key);
    }
  }
  for(const [key,field] of fields)if(!visited.has(key))editorContainer.append(detailField(record,key,field));
  detail.append(editorContainer);card.append(detail);
  host.append(card);
}
function render(){
  if(!draft)return;
  const diag=reviewDiagnostics(draft),cards=$('reviewCards');
  const isPayroll=draft.documentType==='payroll';
  const textOnly=draft.documentType==='ocr-text-only';
  const issueCount=draft.problems.length;
  $('draftSummary').textContent=textOnly?
    'Teksti luettu, mutta yhtään luotettavaa omistusriviä ei muodostettu.':
    (isPayroll?'Palkkalaskelma':'Omistuksia '+diag.recordCount)+
    ' · '+diag.correctedCount+' korjausta · '+issueCount+' tarkistushuomiota.';
  cards.replaceChildren();
  if(textOnly){
    const notice=node('section',undefined,'card');
    notice.append(node('h3','Salkkua ei voitu tunnistaa'),
      node('p','Kuvasta löytyi tekstiä, mutta sarakkeita ei voitu yhdistää turvallisesti. '+
        'Älä korjaa OCR-rivejä yksitellen.','tiny'));
    const details=document.createElement('details');
    details.className='record-details';
    details.append(node('summary','Näytä luettu teksti ('+diag.recordCount+' riviä)'));
    for(const record of draft.records.slice(0,12)){
      const field=record.fields.text;
      if(field)details.append(node('p',String(field.value),'source-line'));
    }
    if(draft.records.length>12)
      details.append(node('p','Muita OCR-rivejä '+(draft.records.length-12)+'.','tiny'));
    notice.append(details);cards.append(notice);
  }else{
    const visibleCount=(!isPayroll&&!allHoldingsShown)?Math.min(4,draft.records.length):draft.records.length;
    for(let i=0;i<visibleCount;i++)
      addDomainCard(cards,draft.records[i],isPayroll,i);
    if(visibleCount<draft.records.length){
      const reveal=node('button','Näytä loput '+(draft.records.length-visibleCount)+' omistusta','reveal-more');
      reveal.type='button';
      reveal.addEventListener('click',()=>{allHoldingsShown=true;render();});
      cards.append(reveal);
    }
  }
  $('issuePanel').hidden=issueCount===0;
  const issues=$('issueItems');issues.replaceChildren();
  if(!issueCount){
    issues.append(node('p','Rakenteellisia estohuomioita ei havaittu. '+
      'Tämä on silti vain testiluonnos.','tiny'));
  }else{
    issues.append(node('p',issueCount+' havaintoa vaatii vielä tarkistuksen. '+
      'Yksityiskohdat ovat kehittäjää varten.','tiny warn'));
    const advanced=document.createElement('details');advanced.className='record-details';
    advanced.append(node('summary','Näytä tekniset huomiot'));
    const issueList=node('div',undefined,'issue-list');
    for(const item of draft.problems.slice(0,25)){
      issueList.append(node('div',String(item.code||'REVIEW_REQUIRED')+
        (item.field?' / '+item.field:''),'tiny'));
    }
    if(issueCount>25)issueList.append(node('p','Lisäksi '+(issueCount-25)+' huomiota.','tiny'));
    advanced.append(issueList);issues.append(advanced);
  }
  $('draftPanel').hidden=false;
}
function showDraft(next,token,imageFile=null){
  if(token!==operation)return;
  draft=next;allHoldingsShown=false;revokeImage();
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
