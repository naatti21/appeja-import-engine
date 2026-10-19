import {evidenceFromOcrTsv} from '../src/import-observations.mjs';
import {extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';
import {preparePortfolioIdentityReview,chooseInstrumentIdentity,undoInstrumentIdentity,cancelPortfolioIdentityReview} from '../src/portfolio-identity-review.mjs';
import {suggestInstrumentListings} from '../src/portfolio-instrument-listings.mjs';

const mounted=new WeakMap();
let runtime;
export async function recognizeLocalPortfolioImage(file,{signal,width,height}) {
 if(!runtime)runtime=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./vendor/ocr/tesseract.min.js';
  script.onload=resolve;script.onerror=()=>{runtime=null;reject(Error('OCR_RUNTIME_UNAVAILABLE'));};document.head.append(script);
 });
 await runtime;if(signal.aborted)throw Error('CANCELLED');
 const worker=await Tesseract.createWorker('fin+eng',1,{workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',corePath:location.origin+'/demo/vendor/ocr/core',langPath:location.origin+'/demo/vendor/ocr/lang',gzip:false,workerBlobURL:false,cacheMethod:'none'});
 const stop=()=>{void worker.terminate().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
 try{
  if(signal.aborted)throw Error('CANCELLED');
  const a=await worker.recognize(file,{}, {tsv:true,text:true});
  if(signal.aborted)throw Error('CANCELLED');
  await worker.reinitialize('eng');const b=await worker.recognize(file,{}, {tsv:true,text:true});
  return {primary:evidenceFromOcrTsv(a.data.tsv,{imageWidth:width,imageHeight:height}),witness:evidenceFromOcrTsv(b.data.tsv,{imageWidth:width,imageHeight:height})};
 }finally{signal.removeEventListener('abort',stop);await worker.terminate();}
}
/** Separate local research page; the optional adapter is injected local test data, never HTTP. */
export function mountPortfolioIdentityReview(root,{recognize=recognizeLocalPortfolioImage,resolver=null}={}) {
 mounted.get(root)?.();
 const $=id=>root.querySelector('#'+id),listeners=new AbortController();
 let rowListeners=new AbortController();
 let review=null,source=null,bitmap=null,imageUrl=null,operation=0,reading=null;
 const outputs=new Map(),busy=new Set();
 const message=text=>{$('feedback').textContent=text;};
 function clear(){
  rowListeners.abort();rowListeners=new AbortController();
  operation++;reading?.abort();reading=null;cancelPortfolioIdentityReview(review);review=null;source=null;
  bitmap?.close();bitmap=null;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;
  outputs.clear();busy.clear();$('portfolioImage').removeAttribute('src');$('fullSource').hidden=true;
  $('pendingRows').replaceChildren();$('reviewedRows').replaceChildren();$('readPortfolio').disabled=false;
 }
 function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
 function button(label,action){const b=element('button',label);b.type='button';b.addEventListener('click',e=>{if(e.isTrusted)action();},{signal:rowListeners.signal});return b;}
 function crop(row){
  const ids=Object.values(row.sourceIds).flat(),words=ids.map(id=>source.observations.find(o=>o.id===id));
  if(!bitmap||words.some(w=>!w?.source?.box)||new Set(words.map(w=>w.source.page)).size!==1)return element('p','Lähdealue on epäselvä. Tarkista koko kuva.');
  const boxes=words.map(w=>w.source.box),top=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.y0))*bitmap.height)-60);
  const bottom=Math.min(bitmap.height,Math.ceil(Math.max(...boxes.map(b=>b.y1))*bitmap.height)+35);
  const nameBoxes=words.filter(w=>row.sourceIds.name.includes(w.id)).map(w=>w.source.box);
  const left=Math.max(0,Math.floor(Math.min(...nameBoxes.map(b=>b.x0))*bitmap.width)-30);
  const right=Math.min(bitmap.width,Math.ceil(Math.max(...nameBoxes.map(b=>b.x1))*bitmap.width)+90);
  const c=element('canvas');c.width=right-left;c.height=bottom-top;c.setAttribute('role','img');c.setAttribute('aria-label','Lähdealue: nimen ympäristö, ei instrumenttivarmennus');
  c.getContext('2d').drawImage(bitmap,left,top,right-left,bottom-top,0,0,c.width,c.height);return c;
 }
 function render(focusRow=null){
  rowListeners.abort();rowListeners=new AbortController();
  $('pendingRows').replaceChildren();$('reviewedRows').replaceChildren();if(!review)return;
  const current=review,epoch=operation;
  for(const row of current.rows){
   const selected=current.userSelections.find(s=>s.rowId===row.rowId),card=element('article');card.className='card'+(selected?' reviewed':'');card.dataset.rowId=row.rowId;
   card.append(element('h3',selected?'Käyttäjän valinta':'Varmentamaton tekstihavainto'),element('p',row.observedText));
   card.append(element('small',`Määrä: ${row.quantity} · Arvo: ${row.marketValue?(row.marketValue.cents/100).toLocaleString('fi-FI')+' '+row.marketValue.currency:'puuttuu'}`));
   const actions=element('div');actions.className='actions';
   const valid=()=>review===current&&operation===epoch;
   if(!selected){
    card.append(element('p','Teksti voi olla nimi tai väliotsikko. Tarkista tämä instrumentti kuvasta. Muita rivejä ei tarvitse käsitellä ensin.'),crop(row));
    const decide=(decision,chosenName)=>{
     if(!valid())return;
     const next=chooseInstrumentIdentity(current,{rowId:row.rowId,decision,chosenName});
     if(next.status==='rejected'){message('Valintaa ei hyväksytty. Tarkista nimi.');return;}
     review=next;render(row.rowId);message('Valinta kirjattu vain tähän luonnokseen. Instrumenttia ei ole varmennettu.');
    };
    const form=element('form');form.hidden=true;
    const label=element('label','Oikea instrumentin nimi'),input=element('input');input.required=true;input.maxLength=140;input.autocomplete='off';label.append(input);
    const submit=element('button','Vahvista korjattu nimi');submit.type='submit';
    form.append(label,submit,button('Takaisin',()=>{form.hidden=true;edit.focus();}));
    form.addEventListener('submit',e=>{e.preventDefault();if(e.isTrusted)decide('correct-name',input.value);},{signal:rowListeners.signal});
    const edit=button('Korjaa nimi',()=>{form.hidden=false;input.focus();});
    actions.append(button('Vahvista havaittu nimi',()=>decide('confirm-observed')),edit,button('Jätä rivi pois',()=>decide('exclude-row')));
    card.append(actions,form);$('pendingRows').append(card);
   }else{
    card.append(element('p',selected.decision==='exclude-row'?'Rivi jätetty pois':`Valittu nimi: ${selected.userSelectedName}`),element('small','Käyttäjän ilmoitus — ei varmennettu instrumentti.'));
    const undo=button('Kumoa valinta',()=>{if(!valid())return;review=undoInstrumentIdentity(current,row.rowId);outputs.clear();render(row.rowId);message('Valinta kumottu. Tarkista nimi uudelleen.');});
    actions.append(undo);
    if(selected.decision!=='exclude-row'){
     const search=button('Hae paikallisesta testihakemistosta',async()=>{
      if(!valid()||busy.has(row.rowId)||outputs.has(row.rowId))return;
      busy.add(row.rowId);search.disabled=true;message('Haetaan vain valitulla nimellä.');
      const result=await suggestInstrumentListings(current,{lookupMode:'local',resolver,rowId:row.rowId});
      // A cancelled/new-file operation owns a different UI: never touch it.
      if(operation!==epoch)return;
      busy.delete(row.rowId);
      if(!valid()){
       // Another row changed the review revision while this request ran.
       // Release only the current control; keep the stale result discarded
       // and preserve other rows' form contents, decisions and focus.
       const card=[...$('reviewedRows').querySelectorAll('article')].find(c=>c.dataset.rowId===row.rowId);
       const control=card?.querySelector('[data-lookup]');
       if(control)control.disabled=!resolver||busy.has(row.rowId)||outputs.has(row.rowId);
       return;
      }
      outputs.set(row.rowId,result);render(row.rowId);message('Paikallinen haku valmis. Tulokset eivät ole varmennuksia.');
     });search.dataset.lookup='';search.disabled=!resolver||busy.has(row.rowId)||outputs.has(row.rowId);actions.append(search);
     if(!resolver)card.append(element('small','Hakupalvelua ei ole kytketty. Mitään tietoa ei lähetetä.'));
     const out=outputs.get(row.rowId);
     if(out)for(const r of out.rows){
      card.append(element('p',r.matches.length?'Paikalliset listaushavainnot — ei varmennettu':'Ei luotettavaa listaustulosta.'));
      for(const m of r.matches)card.append(element('small',`${m.shortname||m.longname} · ${m.symbol} · ${m.exchange}`));
     }
    }
    card.append(actions);$('reviewedRows').append(card);
   }
  }
  if(current.unresolved.some(u=>u.reason!=='UNPROVEN_SEMANTIC_NAME_ROLE'))$('pendingRows').append(element('p','Kaikkia lähderivejä ei voitu sitoa turvallisesti. Tarkista koko kuva; mitään ei tallenneta.'));
  if(focusRow){const cards=[...root.querySelectorAll('article')];cards.find(c=>c.dataset.rowId===focusRow)?.querySelector('button')?.focus();}
 }
 $('portfolioFile').addEventListener('change',()=>{clear();message('Uusi tiedosto valittu. Aiemmat valinnat on poistettu.');},{signal:listeners.signal});
 $('cancelPortfolio').addEventListener('click',e=>{if(!e.isTrusted)return;clear();$('portfolioFile').value='';message('Peruttu. Kuva, valinnat ja hakutulokset tyhjennetty.');},{signal:listeners.signal});
 $('readPortfolio').addEventListener('click',async e=>{
  if(!e.isTrusted)return;const file=$('portfolioFile').files[0];clear();const epoch=operation;
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){message('Valitse PNG-, JPEG- tai WebP-testikuva (enintään 10 Mt).');return;}
  reading=new AbortController();const signal=reading.signal;$('readPortfolio').disabled=true;message('Luetaan kuvaa paikallisesti…');
  try{
   const loaded=await createImageBitmap(file);if(operation!==epoch){loaded.close();return;}
   if(loaded.width*loaded.height>16000000){loaded.close();throw Error('IMAGE_TOO_LARGE');}bitmap=loaded;
   imageUrl=URL.createObjectURL(file);$('portfolioImage').src=imageUrl;$('fullSource').hidden=false;
   const {primary,witness}=await recognize(file,{signal,width:bitmap.width,height:bitmap.height});
   if(operation!==epoch||signal.aborted)return;
   source=primary;review=preparePortfolioIdentityReview(extractVisualPortfolioCorroborated(primary,witness),primary);
   render();message(`${review.rows.length} varmentamatonta havaintoa. Valitse käsiteltävä rivi.`);
  }catch{if(operation===epoch){clear();message('Kuvan lukeminen epäonnistui. Valitse testikuva uudelleen.');}}
  finally{if(operation===epoch)$('readPortfolio').disabled=false;}
 },{signal:listeners.signal});
 const dispose=()=>{clear();listeners.abort();};mounted.set(root,dispose);return {dispose};
}
