import {classifySources} from './classify.mjs';
import {fromPdfJsTextItems} from '../reader-bridge-v1/bridge.mjs';
import {reviewPdf} from './example-pdf.mjs';
const $=id=>document.getElementById(id);
const node=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const reasons={'page-counter':'Sivunumero vastaa PDF:n sivumäärää.','administrative-timestamp':'Tarkasti rajattu muodostus- tai tulostusaika.','document-reference':'Nimenomainen asiakirjatunnus; ei rahamäärä.','administrative-notice':'Tunnistettu hallinnollinen huomautus.','document-language':'Asiakirjan ilmoitettu kieli.','unresolved-source':'Taloudellinen tai tuntematon sisältö tarvitsee selvityksen.','overlapping-source':'Lähteet ovat päällekkäin; tulkintaan ei voi luottaa.','conflicting-metadata':'Hallinnolliset ilmoitukset ovat ristiriidassa.','invalid-or-unplaced-source':'Lähteen tunniste tai sijainti on epävarma.','reader-incomplete':'Lukemisessa havaittiin puutteita.'};
let task=null,doc=null,revision=0,renderTask=null;
function reset(){revision++;renderTask?.cancel();renderTask=null;const old=task;task=null;doc=null;if(old)void old.destroy().catch(()=>{});for(const id of ['result','source','error'])$(id).hidden=true;for(const id of ['actionable','information','readerIssues'])$(id).replaceChildren();$('sourceText').textContent='';$('preview').hidden=true;}
function busy(value){for(const id of ['import','example','file'])$(id).disabled=value;}
async function inspectSource(o,ticket){
 $('source').hidden=false;$('sourceText').textContent=JSON.stringify(o,null,2);$('preview').hidden=true;$('source').focus();
 renderTask?.cancel();renderTask=null;
 try{const page=await doc.getPage(o.page);if(ticket!==revision)return;const v=page.getViewport({scale:.65}),canvas=$('preview');canvas.width=v.width;canvas.height=v.height;
 const pending=page.render({canvasContext:canvas.getContext('2d'),viewport:v});renderTask=pending;await pending.promise;if(ticket!==revision||renderTask!==pending)return;
 const b=o.box;if(b){const ctx=canvas.getContext('2d');ctx.strokeStyle='#b32c17';ctx.lineWidth=3;ctx.strokeRect(b.x0*canvas.width,b.y0*canvas.height,(b.x1-b.x0)*canvas.width,(b.y1-b.y0)*canvas.height);}canvas.hidden=false;
 }catch(e){if(ticket===revision&&e.name!=='RenderingCancelledException')$('sourceText').append('\nEsikatselu epäonnistui: '+e.message);}
}
async function load(bytes){
 reset();busy(true);const ticket=revision;$('status').textContent='PDF luetaan paikallisesti…';
 try{
 const pdfjs=await import('../browser-review-v1/vendor/pdfjs/pdf.min.mjs');if(ticket!==revision)return;
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../browser-review-v1/vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 const current=pdfjs.getDocument({data:bytes,isEvalSupported:false});task=current;const pdf=await current.promise;if(ticket!==revision)return;doc=pdf;
 if(pdf.numPages>20)throw new Error('PDF ylittää 20 sivun rajan.');const pages=[];let count=0;
 for(let i=1;i<=pdf.numPages;i++){
 const p=await pdf.getPage(i),v=p.getViewport({scale:1});if(ticket!==revision)return;
 if(v.rotation!==0||!Array.isArray(p.view)||Math.abs(p.view[0])>.0001||Math.abs(p.view[1])>.0001||Math.abs(p.view[2]-v.width)>.0001||Math.abs(p.view[3]-v.height)>.0001)throw new Error('Kierrettyä tai rajattua sivua ei tueta turvallisesti.');
 const items=(await p.getTextContent()).items;count+=items.length;if(count>2000)throw new Error('PDF ylittää 2 000 tekstielementin koerajan.');pages.push({width:v.width,height:v.height,items});
 }
 if(ticket!==revision)return;const layout=fromPdfJsTextItems(pages);if(!layout.observations.length)throw new Error('PDF:ssä ei ole luettavaa tekstikerrosta. Kuva-PDF tarvitsee erillisen OCR-tarkistuksen.');
 const result=classifySources(layout);$('result').hidden=false;$('summary').textContent=`${result.summary.original} alkuperäistä havaintoa · ${result.summary.actionable} tarkistettavaa · ${result.summary.administrative} informatiivista`;
 for(const issue of result.issues)$('readerIssues').append(node('p','Lukemisen puute: '+issue.code));
 result.entries.forEach((e,i)=>{const card=node('article','');card.dataset.sourceId=e.sourceId;card.dataset.category=e.category;card.append(node('strong',e.category==='administrative'?'Informatiivinen':e.category==='financial'?'Taloudellinen havainto':'Epävarma tai ristiriitainen'),node('p',e.raw),node('small',reasons[e.reason]??e.reason),node('small','Lähde-ID: '+e.sourceId));const b=node('button','Näytä alkuperäinen lähde');b.addEventListener('click',()=>void inspectSource(result.observations[i],ticket));card.append(b);$(e.requiresCorrection?'actionable':'information').append(card);});
 if(!result.summary.actionable)$('actionable').append(node('p','Ei ratkaisemattomia lähdehavaintoja tässä luokituksessa. Taloudellista hyväksyntää ei tehty.'));
 $('status').textContent=result.correctionRequired?'Korjausta tai selvitystä tarvitaan. Mitään ei tallennettu.':'Vain informatiivisia havaintoja. Ei hyväksyntää eikä tallennusta.';
 }catch(e){if(ticket===revision){reset();$('error').hidden=false;$('error').textContent='Tuonti keskeytyi: '+e.message;$('status').textContent='Tarkistus epäonnistui. Aiemmat tulokset poistettiin.';}}
 finally{if(ticket===revision||!task)busy(false);}
}
$('example').addEventListener('click',()=>void load(reviewPdf()));
$('import').addEventListener('click',async()=>{const file=$('file').files[0];if(!file||!file.name.toLowerCase().endsWith('.pdf')||!file.size||file.size>5*1024*1024){reset();$('error').hidden=false;$('error').textContent='Valitse PDF, jonka koko on 1 tavusta 5 Mt:uun.';return;}
 // Reading bytes is also cancellable by generation; never revive a cleared selection.
 const ticket=revision;busy(true);try{const bytes=new Uint8Array(await file.arrayBuffer());if(ticket===revision)await load(bytes);}catch(e){if(ticket===revision){reset();$('error').hidden=false;$('error').textContent='Tiedoston lukeminen epäonnistui: '+e.message;}}finally{if(!task)busy(false);}
});
$('clear').addEventListener('click',()=>{reset();busy(false);$('file').value='';$('status').textContent='Tyhjennetty. Mitään ei tallennettu.';});
