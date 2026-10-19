import {recognizeLocalPortfolioImage} from './portfolio-identity-review.mjs';
import {extractFundSnapshot,extractFundCostBasisDetail,parseDisplayedDecimal} from '../src/fund-snapshots.mjs';
const mounted=new WeakMap();
const titles={quantity:'Osuudet yhteensä',value:'Nykyarvo',nav:'NAV',averageAcquisitionPrice:'Keskihankintahinta'};
/** Ephemeral research review. No resolver, persistence, account merge or storage API. */
export function mountFundSnapshotReview(root,{recognize=recognizeLocalPortfolioImage}={}){
 mounted.get(root)?.dispose();const listeners=new AbortController();let cards=new AbortController(),rowControllers=new Map(),epoch=0,reading=null,bitmap=null,url=null,draft=null;
 const $=id=>root.querySelector('#'+id),el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function clear(){epoch++;reading?.abort();reading=null;bitmap?.close();bitmap=null;if(url)URL.revokeObjectURL(url);url=null;draft=null;cards.abort();rowControllers.clear();cards=new AbortController();$('fundRows').replaceChildren();$('fundImage').removeAttribute('src');$('fundSource').hidden=true;$('readFunds').disabled=false;}
 function button(label,fn,signal){const b=el('button',label);b.type='button';b.addEventListener('click',e=>{if(e.isTrusted)fn();},{signal});return b;}
 function render(targetRowId=null){
  if(targetRowId===null){cards.abort();rowControllers.clear();cards=new AbortController();$('fundRows').replaceChildren();}if(!draft)return;
  for(const row of draft.snapshot.rows.filter(r=>targetRowId===null||r.rowId===targetRowId)){
   rowControllers.get(row.rowId)?.abort();const rowCards=new AbortController();rowControllers.set(row.rowId,rowCards);const cardSignal=rowCards.signal;cards.signal.addEventListener('abort',()=>rowCards.abort(),{once:true});
   const rowButton=(label,fn)=>button(label,fn,cardSignal);
   const existing=[...$('fundRows').children].find(e=>e.dataset.rowId===row.rowId);
   const article=el('article');article.dataset.rowId=row.rowId;const title=row.fields.name.raw||'Epäselvä nimi';article.append(el('h2',title),el('small','Varmentamaton nimihavainto — voi olla myös otsikko. Ei instrumenttihakua tai automaattista hyväksyntää.'));
   const ids=Object.values(row.fields).flatMap(f=>f.evidence),boxes=ids.map(e=>e.box);
   if(boxes.length&&bitmap){const y0=Math.max(0,Math.min(...boxes.map(b=>b.y0))-.02),y1=Math.min(1,Math.max(...boxes.map(b=>b.y1))+.02),c=el('canvas');c.width=bitmap.width;c.height=Math.ceil((y1-y0)*bitmap.height);c.setAttribute('role','img');c.setAttribute('aria-label','Rahastohavainnon lähdealue');c.getContext('2d').drawImage(bitmap,0,y0*bitmap.height,bitmap.width,c.height,0,0,c.width,c.height);article.append(c);}
   const dl=el('dl');for(const [key,label] of Object.entries(titles)){const f=row.fields[key];dl.append(el('dt',label),el('dd',f.status==='observed'?f.raw:f.status==='missing'?'Puuttuu kuvasta':`Epäselvä: ${f.raw||'tarkista lähde'}`));}article.append(dl);
   article.append(el('small','Luvut säilyttävät kuvan desimaalitarkkuuden ja voivat olla pyöristettyjä. Tuottoa ei lasketa.'));
   if(row.structuralStatus==='UNRESOLVED')article.append(el('p','Rivin nimi, määrä tai arvo jäi epävarmaksi. Tarkista alkuperäinen kuva; tästä ei muodosteta omistusta.'));
   if(row.canRequestCostBasis){
    const supplied=draft.userObservations.find(o=>o.rowId===row.rowId);
    if(supplied){article.append(el('p',`Käyttäjän erillinen havainto: ${supplied.raw}. Alkuperäisen kuvan keskihankintahinta puuttuu edelleen.`),rowButton('Kumoa täydennys',()=>{draft.userObservations=draft.userObservations.filter(o=>o!==supplied);render(row.rowId);}));}
    else if(draft.deferred.has(row.rowId))article.append(el('p','Täydennys jätetty myöhemmäksi. Keskihankintahintaa ei vahvistettu.'),rowButton('Täydennä',()=>{draft.deferred.delete(row.rowId);render(row.rowId);}));
    else{
     article.append(el('p','Keskihankintahinta puuttuu tästä kuvasta. Haluatko täydentää sen rahaston tiedoista?'));
     const form=el('form');form.hidden=true;const label=el('label','Erikseen tarkistettu keskihankintahinta'),input=el('input');input.inputMode='decimal';input.required=true;label.append(input);
     const noteLabel=el('label','Mistä tiedosta tarkistit hinnan?'),note=el('input');note.required=true;note.maxLength=160;noteLabel.append(note);
     const detailLabel=el('label','Erillinen rahaston tietokuva (valinnainen)'),detailFile=el('input');detailFile.type='file';detailFile.accept='image/png,image/jpeg,image/webp';detailLabel.append(detailFile);const detailPreview=el('div');let detailEvidence=null,detailRevision=0,detailReading=null,appliedDetail=null;
     input.addEventListener('input',()=>{detailEvidence=null;appliedDetail=null;},{signal:cardSignal});
     const currentDraft=draft,currentEpoch=epoch;
     cardSignal.addEventListener('abort',()=>detailReading?.abort(),{once:true});
     detailFile.addEventListener('change',async()=>{
      detailReading?.abort();detailReading=new AbortController();const signal=detailReading.signal,version=++detailRevision;
      if(appliedDetail!==null){input.value='';note.value='';appliedDetail=null;}detailEvidence=null;detailPreview.replaceChildren();const file=detailFile.files[0];
      if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)return;
      const live=()=>epoch===currentEpoch&&draft===currentDraft&&!cardSignal.aborted&&version===detailRevision;
      let image;try{image=await createImageBitmap(file);if(!live())return;if(image.width*image.height>16000000)throw Error('IMAGE_TOO_LARGE');
       const canvas=el('canvas');canvas.width=image.width;canvas.height=image.height;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Erillinen rahaston tietokuva');canvas.getContext('2d').drawImage(image,0,0);detailPreview.append(canvas,el('p','Tarkista itse, että tietokuva kuuluu tähän rahastoon ja tiliin. Automaattista yhdistämistä ei tehdä.'));
       const {primary,witness}=await recognize(file,{signal,width:image.width,height:image.height});if(!live())return;
       const detail=extractFundCostBasisDetail(primary,witness),price=detail.rows.length===1?detail.rows[0].fields.averageAcquisitionPrice:null;
       const detailName=detail.rows[0]?.fields.name;const sameName=detailName?.status==='observed'&&row.fields.name.status==='observed'&&detailName.raw.normalize('NFKC').trim().toLowerCase()===row.fields.name.raw.normalize('NFKC').trim().toLowerCase();
       if(sameName&&price?.status==='observed'&&row.fields.currency.status==='observed'&&price.currency===row.fields.currency.value)detailPreview.append(el('p',`Erillisen kuvan havainto: ${price.raw}`),rowButton('Käytä erillisen kuvan hintaa luonnoksessa',()=>{if(!live())return;input.value=price.decimal;appliedDetail=price.decimal;note.value='Käyttäjän tähän rahastoon kohdistama erillinen tietokuva';detailEvidence=detail;input.focus();}));
       else detailPreview.append(el('p','Rahaston nimihavaintoa, hintaa tai samaa valuuttaa ei saatu yksiselitteisesti. Täydennä vain itse tarkistamasi tieto.'));
      }catch{if(live())detailPreview.append(el('p','Tietokuvan lukeminen epäonnistui.'));}finally{image?.close();}
     },{signal:cardSignal});
     const submit=el('button','Vahvista erillinen käyttäjähavainto');submit.type='submit';const error=el('p');error.setAttribute('role','status');form.append(detailLabel,detailPreview,label,noteLabel,submit,error);
     form.addEventListener('submit',e=>{e.preventDefault();if(!e.isTrusted)return;const n=parseDisplayedDecimal(input.value);if(!n||!note.value.trim()){error.textContent='Anna positiivinen hinta ja lähteen kuvaus. Valuutta säilyy lähdekuvan havaintona.';return;}draft.userObservations.push({rowId:row.rowId,field:'averageAcquisitionPrice',raw:input.value,...n,currency:row.fields.currency.status==='observed'?row.fields.currency.value:null,requiresCurrencyReview:row.fields.currency.status!=='observed',source:{kind:'user-observation',description:note.value.trim(),detailEvidence},marketIdentityVerified:false,canPersist:false});render(row.rowId);},{signal:cardSignal});
     article.append(rowButton('Täydennä',()=>{form.hidden=false;input.focus();}),rowButton('Myöhemmin',()=>{draft.deferred.add(row.rowId);render(row.rowId);}),form);
    }
   }if(existing)existing.replaceWith(article);else $('fundRows').append(article);
  }
 }
 $('fundFile').addEventListener('change',()=>{clear();$('fundStatus').textContent='Uusi kuva. Aiempi tarkistusluonnos tyhjennetty.';},{signal:listeners.signal});
 $('cancelFunds').addEventListener('click',e=>{if(!e.isTrusted)return;clear();$('fundFile').value='';$('fundStatus').textContent='Peruttu. Kuva ja tilapäiset havainnot poistettu muistista.';},{signal:listeners.signal});
 $('readFunds').addEventListener('click',async e=>{
  if(!e.isTrusted)return;const file=$('fundFile').files[0];clear();const current=epoch;
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){$('fundStatus').textContent='Valitse enintään 10 Mt testikuva.';return;}
  reading=new AbortController();const signal=reading.signal;$('readFunds').disabled=true;$('fundStatus').textContent='Luetaan paikallisesti kahdella OCR-kielellä…';
  try{const image=await createImageBitmap(file);if(current!==epoch){image.close();return;}if(image.width*image.height>16000000){image.close();throw Error('IMAGE_TOO_LARGE');}bitmap=image;url=URL.createObjectURL(file);$('fundImage').src=url;$('fundSource').hidden=false;
   const {primary,witness}=await recognize(file,{signal,width:image.width,height:image.height});if(current!==epoch||signal.aborted)return;
   draft={snapshot:extractFundSnapshot(primary,witness),userObservations:[],deferred:new Set()};render();$('fundStatus').textContent=draft.snapshot.documentRole==='CURRENT_HOLDINGS_SNAPSHOT'?`${draft.snapshot.rows.length} varmentamatonta rahastohavaintoa. Ei tallennusta.`:'Dokumentin rooli jäi epäselväksi. Kuvaa ei tulkita nykyisiksi omistuksiksi.';
  }catch{if(current===epoch){clear();$('fundStatus').textContent='Kuvan lukeminen epäonnistui. Tarkista lähde.';}}
  finally{if(current===epoch)$('readFunds').disabled=false;}
 },{signal:listeners.signal});
 const api={dispose(){clear();listeners.abort();}};mounted.set(root,api);return api;
}
