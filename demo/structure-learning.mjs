import {createMobileReviewSession} from '../src/mobile-review-session.mjs';
import {createStructureLearner} from '../src/structure-learning.mjs';
import {resolveMobileCards,documentKey,corroborateOcrIdentities} from '../src/mobile-card-holdings.mjs';
import {evidenceFromOcrTsv} from '../src/import-observations.mjs';
const $=id=>document.getElementById(id), STORAGE='import-engine:structure-learning:v1';
let session=null;
let learner=createStructureLearner(), persistent=false, source=null, parsed=null, key=null, token=0, url=null, expanded=false;
try {const data=localStorage.getItem(STORAGE);if(data){if(data.length>16384)throw Error();learner=createStructureLearner(JSON.parse(data));persistent=true;}}
catch {$('message').textContent='Tallennetut rakenteet eivät ole käytettävissä. Jatketaan ilman niitä.';}
const say=text=>{$('message').textContent=text;};
const reasons={UNCERTAIN_SOURCE_OR_LAYOUT:'Teksti tai kortin rajat ovat epävarmoja.',IDENTITY_OR_QUANTITY_REQUIRED:'Tunniste tai yksiselitteinen kappalemäärä puuttuu.',OCR_IDENTITY_DISAGREEMENT:'Lukukerrat antavat eri instrumenttitunnisteen.',LEARNING_CONFLICT:'Aiemmat opetukset ovat ristiriidassa.',PROVISIONAL_STRUCTURE:'Rakenne tarvitsee vielä toisen vahvistetun aineiston.',AMBIGUOUS_NAME:'Instrumentin nimelle on useita mahdollisia lähderivejä.',AMBIGUOUS_CURRENCY:'Kortissa on useita valuuttatietoja.'};
const explain=reason=>reasons[reason]??(reason?'Kortti vaatii lähteen tarkistuksen.':'Lähde-ehdotus; tarkista ennen opetusta.');
function clear(){token++;session=null;source=null;$('correctionLine').replaceChildren();$('correctionValue').value='';$('originalText').textContent='';$('correctionStatus').textContent='';$('sourceCrop').width=0;parsed=null;key=null;expanded=false;$('image').value='';$('result').hidden=true;$('rows').replaceChildren();$('reviewState').textContent='';$('learningState').textContent='';$('card').replaceChildren();for(const id of ['entity','identity','measure'])$(id).replaceChildren();if(url)URL.revokeObjectURL(url);url=null;$('preview').removeAttribute('src');}
function change(action){
 const before=learner.export();
 try {const result=action();if(persistent){try{localStorage.setItem(STORAGE,JSON.stringify(learner.export()));}catch{learner=createStructureLearner(before);throw Error('STORAGE');}}render();return result;}
 catch {say('Muutos ei onnistunut. Rakenteita ei vahvistettu. Tarkista valinnat tai selaimen tallennustila.');return null;}
}
function selectCard(){
 const c=parsed?.cards.find(c=>c.id===$('card').value);
 $('reason').textContent=c?explain(c.reason):'Lähteestä ei saatu opetettavaa korttia.';
 for(const [id,role] of [['entity','text'],['identity','identity'],['measure','measure']]){
  $(id).replaceChildren(new Option('Valitse lähderivi',''));
  c?.lines.forEach((line,i)=>{if(line.role===role)$(id).add(new Option(line.text,String(i)));});
 }
 $('teach').disabled=!c?.teachable;
}
function render(){
 if(!source)return;parsed=session.resolve(learner);$('result').hidden=false;$('rows').replaceChildren();
 $('count').textContent=`${parsed.rows.length} lähde-ehdotusta · ${parsed.unresolved.length} estettyä kohtaa`;
 const visible=expanded?parsed.rows:parsed.rows.slice(0,3);
 for(const row of visible){const article=document.createElement('article');
  for(const text of [row.fields.name.value,`${row.fields.quantity.value} kpl · ${Object.values(row.fields.identity.value).join(' / ')}`,`${row.fields.account.value??'Tili puuttuu'} · ${row.fields.currency.value??'Valuutta puuttuu'}`]){const p=document.createElement('p');p.textContent=text;article.append(p);}
  const note=document.createElement('small');note.textContent='B: Ehdokas. C: Ei instrumenttivarmennusta. Hankintahinta puuttuu.';article.append(note);$('rows').append(article);
 }
 $('more').hidden=expanded||parsed.rows.length<=3;$('review').disabled=!visible.length;$('reviewState').textContent='';
 $('card').replaceChildren();parsed.cards.forEach((c,i)=>$('card').add(new Option(`Kortti ${i+1}: ${explain(c.reason)}`,c.id)));selectCard();
}
let loading;
async function worker(language){
 if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/ocr/tesseract.min.js';s.onload=resolve;s.onerror=()=>{loading=null;reject(Error('OCR_ASSETS'));};document.head.append(s);});
 await loading;
 return window.Tesseract.createWorker(language,1,{workerPath:new URL('./vendor/ocr/worker.min.js',location.href).href,corePath:new URL('./vendor/ocr/core',location.href).href,langPath:new URL('./vendor/ocr/lang',location.href).href,gzip:false,workerBlobURL:false,cacheMethod:'none'});
}
$('image').addEventListener('change',async()=>{
 const file=$('image').files[0];clear();if(!file)return;const current=token,language=$('language').value;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){say('Valitse enintään 10 Mt PNG-, JPEG- tai WebP-kuva.');return;}
 let w;
 try {
  say('Luetaan kuvaa paikallisesti…');const bitmap=await createImageBitmap(file);const {width,height}=bitmap;bitmap.close();
  if(width*height>16000000)throw Error('IMAGE_LIMIT');
  w=await worker(language);if(current!==token)return;
  const result=await w.recognize(file,{}, {text:true,tsv:true});if(current!==token)return;
  let next=evidenceFromOcrTsv(result.data.tsv,{imageWidth:width,imageHeight:height});
  if(language!=='eng'){
   await w.reinitialize('eng');const witness=await w.recognize(file,{}, {text:true,tsv:true});if(current!==token)return;
   next=corroborateOcrIdentities(next,evidenceFromOcrTsv(witness.data.tsv,{imageWidth:width,imageHeight:height}));
  }
  const nextKey=await documentKey(next);if(current!==token)return;
  source=next;session=createMobileReviewSession(source);key=nextKey;url=URL.createObjectURL(file);$('preview').src=url;populateCorrectionLines();render();say('Lähde-ehdotukset valmiit. Epävarmuuksia ei hyväksytä automaattisesti.');
 }catch{if(current===token)say('Kuvan lukeminen epäonnistui. OCR-resurssit tai kuva eivät ole käytettävissä.');}
 finally{if(w)await w.terminate();}
});
$('card').onchange=selectCard;
$('teach').onclick=()=>{
 const c=parsed?.cards.find(c=>c.id===$('card').value);if(!c?.teachable)return;
 const values=['entity','identity','measure'];if(values.some(k=>$(k).value==='')){say('Valitse kaikki kolme lähderiviä.');return;}
 const binding=Object.fromEntries(values.map(k=>[k,Number($(k).value)]));
 const state=change(()=>learner.confirm({pattern:c.pattern,binding,documentKey:key,confirmed:true}));
 $('learningState').textContent=state==='active'?'Rakenne vahvistettu kahdesta aineistosta. Ehdotukset vaativat edelleen tarkistuksen.':state==='provisional'?'Alustava rakenne. Tarvitaan toinen eri aineisto ja oma vahvistuksesi.':state==='conflict'?'Ristiriitaiset opetukset. Rakenteen käyttö estetty.':'';
};
$('more').onclick=()=>{expanded=true;render();};
$('review').onclick=()=>{$('reviewState').textContent=`${expanded?parsed.rows.length:Math.min(3,parsed.rows.length)} näkyvää lähde-ehdotusta tarkistettu tässä näkymässä. Puuttuvat tiedot estävät tuonnin. Ei tallennusta eikä automaattista oppimista.`;};
$('cancel').onclick=()=>{clear();say('Lähde ja ehdotukset tyhjennetty.');};
$('undo').onclick=()=>change(()=>learner.undo());
$('forget').onclick=()=>{try{localStorage.removeItem(STORAGE);persistent=false;learner=createStructureLearner();render();say('Rakenteet unohdettu.');}catch{say('Tallennettujen rakenteiden poistaminen epäonnistui.');}};
$('save').onclick=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(learner.export()));persistent=true;say('Vain abstraktien rakenneprofiilien paikallinen tallennus sallittu.');}catch{say('Tallennus epäonnistui. Rakenteet ovat vain tämän sivun muistissa.');}};
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(learner.export(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='engine-structures-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('restore').onchange=async()=>{const file=$('restore').files[0];$('restore').value='';if(!file)return;if(file.size>16384){say('Rakenneprofiili on liian suuri.');return;}try{const data=JSON.parse(await file.text());change(()=>learner.import(data));}catch{say('Rakenneprofiili ei ole kelvollinen.');}};

function populateCorrectionLines(){
 $('correctionLine').replaceChildren();
 session?.lines().forEach(l=>$('correctionLine').add(new Option(l.text,String(l.index))));
 showCorrectionSource();
}
async function showCorrectionSource(){
 const current=token, index=Number($('correctionLine').value), line=session?.lines()[index];
 if(!line)return;
 $('originalText').textContent='A: Alkuperäinen havainto: '+line.text;
 $('correctionValue').value=line.correction?.value??(line.role==='measure'?String(line.value??''):line.text);
 $('correctionStatus').textContent=line.correction?'Käyttäjän korjaus: '+line.correction.value:'';
 if(line.correction)$('correctionField').value=line.correction.field;
 else $('correctionField').value=line.role==='identity'?'identity':line.role==='measure'?'quantity':'name';
 if(!url)return;
 const cropUrl=url, img=new Image();img.src=cropUrl;
 try{await img.decode();}catch{return;}
 if(current!==token||Number($('correctionLine').value)!==index)return;
 const words=session.sources(index), boxes=words.map(o=>o.source.box);
 const x=Math.max(0,Math.min(...boxes.map(b=>b.x0))*img.width-8),y=Math.max(0,line.y0*img.height-8);
 const w=Math.min(img.width-x,Math.max(...boxes.map(b=>b.x1))*img.width-x+8),h=Math.min(img.height-y,line.y1*img.height-y+8);
 const c=$('sourceCrop');c.width=Math.ceil(w);c.height=Math.ceil(h);c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);
}
$('correctionLine').onchange=showCorrectionSource;
$('confirmCorrection').onclick=()=>{
 if(!session)return;
 try{session.correct({line:Number($('correctionLine').value),field:$('correctionField').value,value:$('correctionValue').value,confirmed:true});render();showCorrectionSource();say('Korjaus vahvistettu vain tähän luonnokseen. Voit nyt opettaa kenttien roolit erikseen.');}
 catch{say('Korjausta ei hyväksytty. Tarkista lähderivi, tiedon rooli ja arvon muoto.');}
};
$('undoCorrection').onclick=()=>{if(session){session.undo(Number($('correctionLine').value));render();showCorrectionSource();}};
