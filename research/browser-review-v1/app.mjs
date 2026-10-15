import {makeModel,csvModel,payrollModel,review,sourceLabel,exampleModel,labels,normalizeOcrTsv} from './model.mjs';
import {fromPdfJsTextItems,fromTesseractWordTsv} from '../reader-bridge-v1/bridge.mjs';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=String(value??'');if(cls)e.className=cls;return e;};
let model=null,pdfDoc=null,image=null,shown=50,worker=null,revision=0;
const message={VALUE_SOURCE_SET_NOT_EXACT:'Arvolähteiden koko teksti ei muodosta ehdotettua arvoa.',HEADER_SOURCE_ROLE_MISMATCH:'Otsikko ei vastaa kenttää tai on eri rivillä. Sarakekohtainen sidonta puuttuu.',CONTEXT_SOURCE_CONFLICT:'Konteksti on ristiriitainen tai eri rivillä. Dokumenttitason sidontaa ei tueta.',UNTYPED_OR_MISSING_VALUE_CLAIM:'Lähteiden rooleja ei ole erotettu. Nimeä arvo- ja otsikkolähteet erikseen.',UNREVIEWED_SOURCE_OBSERVATION:'Luokittelematon lähdehavainto: voi olla tärkeä tieto tai metatietoa. Säilytetty tarkistettavaksi.'};
function busy(on){for(const id of ['analyze','payrollExample','holdingsExample','probeExample','sourceFile'])$(id).disabled=on;}
function clearResult(){
 model=null;image?.close();image=null;shown=50;$('results').hidden=true;$('error').hidden=true;$('error').textContent='';
 for(const id of ['fields','warnings','sources','notes'])$(id).replaceChildren();$('sourceText').textContent='';$('preview').hidden=true;
 if(pdfDoc){void pdfDoc.destroy();pdfDoc=null;}
}
function showError(error){$('error').textContent='Tuonti keskeytyi: '+String(error?.message??error);$('error').hidden=false;$('status').textContent='Esitarkistus epäonnistui. Aiemmat tulokset poistettiin; mitään ei tallennettu.';}
async function execute(action){const ticket=++revision;clearResult();busy(true);$('status').textContent='Lähdettä luetaan paikallisesti…';
 try{const next=await action();if(ticket!==revision)return;model=next;render();$('status').textContent='Esitarkistus valmis. Vaatii tarkistuksen; mitään ei tallennettu.';}
 catch(e){if(ticket===revision){clearResult();showError(e);}}
 finally{if(ticket===revision)busy(false);}
}
async function pdfModel(bytes){
 const pdfjs=await import('../../demo/vendor/pdfjs/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../../demo/vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 pdfDoc=await pdfjs.getDocument({data:bytes}).promise;
 if(pdfDoc.numPages>20)throw new Error('PDF:ssä on yli 20 sivua. Rajaa synteettistä koetta.');
 const pages=[];
 for(let i=1;i<=pdfDoc.numPages;i++){const p=await pdfDoc.getPage(i),v=p.getViewport({scale:1});
  if(v.rotation!==0)throw new Error('Kierrettyä PDF-sivua ei tueta turvallisena lähdekoordinaattina.');
  if(!Array.isArray(p.view)||Math.abs(p.view[0])>0.0001||Math.abs(p.view[1])>0.0001||Math.abs(p.view[2]-p.view[0]-v.width)>0.0001||Math.abs(p.view[3]-p.view[1]-v.height)>0.0001)throw new Error('Rajattua PDF-sivua ei tueta turvallisena lähdekoordinaattina.');
  pages.push({width:v.width,height:v.height,items:(await p.getTextContent()).items});}
 const layout=fromPdfJsTextItems(pages),salary=/palkka|payroll/i.test(layout.observations.map(o=>o.raw).join(' '));
 return salary?payrollModel(layout):makeModel(layout,{},'PDF',['PDF:n dokumenttityyppiä ei tunnistettu. Lähdeteksti näkyy, mutta kenttiä ei arvata.']);
}
async function loadOcr(){
 if(window.Tesseract?.createWorker)return window.Tesseract;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;s.onload=resolve;s.onerror=()=>reject(new Error('Paikallista OCR-pakettia ei ole valmisteltu. Verkkopalveluun ei siirrytä.'));document.head.append(s);});
 if(!window.Tesseract?.createWorker)throw new Error('OCR-paketti ei käynnistynyt.');return window.Tesseract;
}
async function imageModel(file){
 image=await createImageBitmap(file);if(image.width*image.height>16000000)throw new Error('Kuva ylittää 16 megapikselin koerajan.');
 const api=await loadOcr(),root=new URL('./vendor/ocr/',import.meta.url);
 worker=await api.createWorker('eng',1,{workerPath:new URL('worker.min.js',root).href,corePath:new URL('core/',root).href,langPath:new URL('lang/',root).href,gzip:true,workerBlobURL:false,cacheMethod:'none',logger:p=>{if(p.progress!=null)$('status').textContent='Paikallinen OCR '+Math.round(p.progress*100)+' %';}});
 try{const result=await worker.recognize(file,{}, {text:true,tsv:true});
  const layout=fromTesseractWordTsv(normalizeOcrTsv(result.data.tsv),[{width:image.width,height:image.height}]);
  if(!layout.observations.length)throw new Error('Kuvasta ei löytynyt luettavaa tekstiä.');
  return makeModel(layout,{},'Kuva / oikea OCR',['Englannin OCR-malli. Sanat ja lähdekoordinaatit näkyvät, mutta palkka- ja sijoitusrivien merkityksiä ei ole vahvistettu. OCR-confidence ei ole hyväksyntätodiste.']);
 }finally{await worker?.terminate();worker=null;}
}
async function selectedFile(){const file=$('sourceFile').files[0];if(!file)throw new Error('Valitse ensin synteettinen tiedosto.');
 if(!file.size||file.size>5*1024*1024)throw new Error('Tiedoston koon on oltava 1 tavun ja 5 Mt:n välillä.');
 const ext=file.name.toLowerCase().split('.').pop();
 if(ext==='csv')return csvModel(await file.text());if(ext==='pdf')return pdfModel(new Uint8Array(await file.arrayBuffer()));
 if(['png','jpg','jpeg'].includes(ext))return imageModel(file);throw new Error('Tuettuja muotoja ovat PDF, CSV, PNG ja JPEG.');
}
function render(){
 const r=review(model),layout=model.original.layout;$('results').hidden=false;
 const warnings=[...r.result.issues,...(r.result.audit?.newWarnings??[])];
 $('summary').textContent=`${model.format} · ${layout.observations.length} alkuperäistä havaintoa · ${Object.keys(r.fields).length} kenttäehdotusta · ${warnings.length} tarkistettavaa kohtaa.`;
 $('notes').replaceChildren(...model.notes.map(n=>text('p',n,'muted')));
 $('warnings').replaceChildren();
 const grouped=new Map();for(const w of warnings){const o=layout.observations.find(o=>o.id===w.sourceId);const key=o?.kind==='cell'?'CSV-rivi '+o.sourceLine:w.page?'Sivu '+w.page:'Yleiset';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(w);}
 for(const [group,items]of grouped){const d=document.createElement('details');d.append(text('summary',`${group} · ${items.length} kohtaa`));for(const w of items)d.append(text('p',(message[w.code]??w.code)+(w.sourceId?' · '+w.sourceId:''),'audit'));$('warnings').append(d);}
 $('fields').replaceChildren();
 if(!Object.keys(r.fields).length)$('fields').append(text('p','Kenttiä ei ole semanttisesti tunnistettu. Tarkista alkuperäiset havainnot.'));
 for(const [key,f]of Object.entries(r.fields)){
  const original=model.original.fields[key],name=(labels[f.semanticKey??key]??key),card=text('article','', 'card field');card.dataset.field=key;
  card.append(text('h3',name),text('small','Alkuperäinen ehdotus: '+(original.value??'puuttuu')),
   text('small','Alkuperäiset lähteet: '+(original.sourceIds??[]).join(', ')));
  const field=(suffix,label,value,parent=card)=>{const id=key+'-'+suffix;const l=text('label',label);l.htmlFor=id;const input=document.createElement('input');input.id=id;input.value=value??'';parent.append(l,input);return input;};
  const edit=model.edits[key],value=field('value',name+' · luonnosarvo',edit?.value??f.value??''),roles=edit??f.sourceRoles??{valueIds:f.sourceIds??[],headerIds:[],contextIds:[]};
  const ids=new Set(f.sourceIds??[]),blocked=f.status!=='verified'||!ids.size||r.result.issues.some(i=>i.field===key||i.owner==='field:'+key)||
   (r.result.audit?.newWarnings??[]).some(w=>ids.has(w.sourceId));
  const state=text('p',blocked?'Lähdesidos vaatii tarkistuksen.':'Lähdeteksti täsmää; taloudellista merkitystä ei ole vahvistettu.','audit');state.dataset.claimState='';card.append(state);
  const roleEditor=document.createElement('details');roleEditor.append(text('summary','Lähderoolien tarkistus'));card.append(roleEditor);
  const values=field('values','Arvolähteiden ID:t',roles.valueIds.join(', '),roleEditor),headers=field('headers','Otsikkolähteiden ID:t',roles.headerIds.join(', '),roleEditor),contexts=field('contexts','Kontekstilähteiden ID:t',roles.contextIds.join(', '),roleEditor),currency=field('currency','Odotettu valuutta (jos konteksti)',edit?.currency??f.context?.currency??'',roleEditor);
  const split=input=>input.value.split(',').map(s=>s.trim()).filter(Boolean);
  const apply=text('button','Tarkista luonnos'),restore=text('button','Palauta alkuperäinen');
  apply.addEventListener('click',()=>{const old=model.edits[key];try{
   model.edits[key]={value:value.value,valueIds:split(values),headerIds:split(headers),contextIds:split(contexts),currency:currency.value.trim()};review(model);$('error').hidden=true;render();$('status').textContent='Luonnos tarkistettu. Lähteet säilyivät; mitään ei hyväksytty eikä tallennettu.';
  }catch(e){if(old)model.edits[key]=old;else delete model.edits[key];$('error').hidden=false;$('error').textContent='Luonnosta ei sovellettu: '+e.message;$('status').textContent='Edellinen ehdotus ja alkuperäiset lähteet säilyivät. Ei tallennusta.';}});
  restore.addEventListener('click',()=>{delete model.edits[key];$('error').hidden=true;render();$('status').textContent='Alkuperäinen ehdotus palautettu. Mitään ei tallennettu.';});
  const show=text('button','Näytä kentän lähde');show.disabled=!(original.sourceIds??[]).length;show.addEventListener('click',()=>{const o=layout.observations.find(o=>(original.sourceIds??[]).includes(o.id));if(o)void selectSource(o).catch(e=>{$('sourceText').textContent='Esikatselu keskeytyi: '+e.message;});});
  card.append(apply,restore,show,text('small',edit?'Oma luonnosehdotus · ei alkuperäistä lähdetietoa':'Muuttumaton alkuperäinen ehdotus'));$('fields').append(card);
 }
 renderSources();
}
function renderSources(){const observations=model.original.layout.observations;
 $('sourceCount').textContent=`Näytetään ${Math.min(shown,observations.length)} / ${observations.length} havaintoa. Valitse havainto nähdäksesi alkuperäisen tekstin ja sijainnin.`;
 $('sources').replaceChildren();for(const o of observations.slice(0,shown)){const b=text('button',`${sourceLabel(o)} · ${o.raw}`,'source');b.dataset.sourceId=o.id;b.addEventListener('click',()=>void selectSource(o).catch(e=>{$('sourceText').textContent='Esikatselu keskeytyi: '+e.message;}));$('sources').append(b);}
 $('more').hidden=shown>=observations.length;
}
async function selectSource(o){
 $('sourceText').textContent=JSON.stringify({id:o.id,raw:o.raw,location:sourceLabel(o),box:o.box??null,confidence:o.ocrConfidence??null},null,2);
 const canvas=$('preview');canvas.hidden=true;
 if(pdfDoc){const page=await pdfDoc.getPage(o.page),v=page.getViewport({scale:.55});canvas.width=v.width;canvas.height=v.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;canvas.hidden=false;}
 else if(image){canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);canvas.hidden=false;}
 if(!canvas.hidden&&o.box){const ctx=canvas.getContext('2d');ctx.strokeStyle='#d50000';ctx.lineWidth=4;ctx.strokeRect(o.box.x0*canvas.width,o.box.y0*canvas.height,(o.box.x1-o.box.x0)*canvas.width,(o.box.y1-o.box.y0)*canvas.height);}
 $('sourceDetails').focus();
}
$('analyze').addEventListener('click',()=>void execute(selectedFile));
$('payrollExample').addEventListener('click',()=>void execute(()=>pdfModel(syntheticPayrollPdf([{fullSlip:true}]))));
$('holdingsExample').addEventListener('click',()=>void execute(()=>csvModel('Name;Quantity;Buy Price;Currency;Account\nSYNTH-A;8;12,50;EUR;SYN-1\nSYNTH-A;3;;EUR;SYN-2')));
$('probeExample').addEventListener('click',()=>void execute(()=>exampleModel($('probe').value)));
$('clear').addEventListener('click',()=>{revision++;void worker?.terminate();worker=null;clearResult();$('sourceFile').value='';busy(false);$('status').textContent='Koe tyhjennetty. Ei tallennettuja tietoja.';});
$('more').addEventListener('click',()=>{shown+=50;renderSources();});
