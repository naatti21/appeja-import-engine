import {layoutFromPdfItems} from '../src/layout.mjs';
import {parsePayrollLayout} from '../src/payroll.mjs';
import {parseHoldingsCsv} from '../src/holdings.mjs';
import {payrollPage} from './synthetic.mjs';
import {syntheticPayrollPdf} from './native-pdf.mjs';
import {readPdfWithPdfJs} from '../src/layout.mjs';
const root=document.getElementById('result');
const el=(name,text,className)=>{
  const n=document.createElement(name);n.textContent=String(text);
  if(className)n.className=className;
  return n;
};
const add=(node)=>root.append(node);
const table=(head,rows)=>{
  const wrap=document.createElement('div');wrap.className='scroll';
  const t=document.createElement('table');const thead=document.createElement('thead');
  const thr=document.createElement('tr');head.forEach(h=>thr.append(el('th',h)));thead.append(thr);t.append(thead);
  const tbody=document.createElement('tbody');
  for(const record of rows){const tr=document.createElement('tr');record.forEach(value=>tr.append(el('td',value)));tbody.append(tr);}
  t.append(tbody);wrap.append(t);add(wrap);
};
function start(title,metricCount,status,issues) {
  root.replaceChildren(el('h2',title));
  add(el('div',status===0?'Ei havaittuja estäviä ongelmia — vain ehdotus':'Tarkistus vaaditaan — ei automaattista hyväksyntää',status===0?'status good':'status bad'));
  const stats=document.createElement('div');stats.className='stat-grid';
  for(const [value,label] of [[metricCount,'havaintoa'],[issues.length,'estettä / huomautusta'],[0,'tallennusta']]){
    const n=document.createElement('div');n.className='stat';n.append(el('span',label),el('b',value));stats.append(n);
  }
  add(stats);
}
function pdfRun(mode){
  let pages;
  if(mode==='conflict')pages=[payrollPage({ytd:'42 000,00'}),payrollPage({ytd:'43 000,00'})];
  else if(mode==='matching')pages=[payrollPage({ytd:'42 000,00'}),payrollPage({ytd:'42 000,00'})];
  else if(mode==='reverse')pages=[payrollPage({reverse:true})];
  else pages=[payrollPage({includeYtd:false})];
  const layout=layoutFromPdfItems(pages);
  const parsed=parsePayrollLayout(layout);
  start('PDF-geometria · synteettinen',layout.observations.length,parsed.canAutoAccept?0:1,parsed.issues);
  add(el('p','Kohdistetut rahasummat ja kaikki samalle kentälle ehdotetut havainnot:'));
  table(['Kenttä','Tila','Arvoehdotukset / sivut'],Object.entries(parsed.fields).map(([role,f])=>[
    role,f.status,(f.candidates||[]).map(c=>`${c.raw} (sivu ${c.page})`).join(' · ')||'—'
  ]));
  if(parsed.issues.length){add(el('h2','Rakenteen ongelmat'));table(['Koodi','Sivu','Taulukko'],parsed.issues.map(i=>[i.code,i.page??'—',i.tableId??'—']));}
  add(el('h2','Alkuperäiset tekstihavainnot'));
  table(['ID','Sivu','Teksti','Sijainti X/Y'],layout.observations.map(o=>[o.id,o.page,o.raw,o.box?`${o.box.x0.toFixed(3)} / ${o.box.y0.toFixed(3)}`:'puuttuu']));
}
function csvRun(){
  try {
    const result=parseHoldingsCsv(document.getElementById('csv').value);
    start('CSV-solut · synteettinen',result.observationCount,result.canAutoAccept?0:1,result.issues);
    add(el('p',`${result.records.length} tietueriviä. Tarkistus: ${result.status}. Tuntemattomia soluja: ${result.unusedObservations.length}.`));
    for(const r of result.records){
      add(el('h2',`Rivi ${r.sourceRow} · ${r.status}`));
      table(['Kenttä','Raaka-arvo','Tila','Tulkinta'],Object.entries(r.fields).map(([name,f])=>[name,JSON.stringify(f.raw),f.status,f.value??'—']));
      if(r.issues.length)add(el('pre',r.issues.map(i=>i.code).join('\n')));
    }
    if(result.issues.length){add(el('h2','Erän esteet'));add(el('pre',result.issues.map(i=>JSON.stringify(i)).join('\n')));}
  }catch(e){root.replaceChildren(el('h2','CSV:n tulkinta estetty'),el('p',e.message,'status bad'));}
}
document.getElementById('conflict').addEventListener('click',()=>pdfRun('conflict'));
document.getElementById('matching').addEventListener('click',()=>pdfRun('matching'));
document.getElementById('reverse').addEventListener('click',()=>pdfRun('reverse'));
document.getElementById('missing').addEventListener('click',()=>pdfRun('missing'));
document.getElementById('parseCsv').addEventListener('click',csvRun);

async function nativePdfRun(){
  root.replaceChildren(el('h2','PDF.js: oikea PDF-luku käynnistyy...'));
  try {
    const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
    const pdf=syntheticPayrollPdf([{ytd:'42 000,00'},{ytd:'43 000,00'}]);
    const started=performance.now();
    const layout=await readPdfWithPdfJs(pdfjs,pdf);
    const parsed=parsePayrollLayout(layout);
    const ms=Math.round(performance.now()-started);
    start('PDF.js: oikea PDF-luku',layout.observations.length,parsed.canAutoAccept?0:1,parsed.issues);
    add(el('p','PDF.js-käsittely '+ms+' ms, '+pdf.byteLength+' PDF-tavua, '+layout.pages.length+' sivua.'));
    add(el('h2',parsed.fields.ytdTaxableIncome.status==='conflict'?'Ristiriita havaittu':'Tulkinnan tila'));
    table(['Kenttä','Tila','Arvot ja lähdesivut'],Object.entries(parsed.fields).map(([name,f])=>[
      name,f.status,(f.candidates||[]).map(c=>c.raw+' (sivu '+c.page+')').join(' · ')||'—'
    ]));
    if(parsed.issues.length)table(['Ongelma','Sivu'],parsed.issues.map(i=>[i.code,i.page??'—']));
    add(el('h2','Alkuperäiset PDF.js-tekstihavainnot'));
    table(['ID','Sivu','Teksti','X/Y'],layout.observations.map(t=>[
      t.id,t.page,t.raw,t.box?t.box.x0.toFixed(3)+' / '+t.box.y0.toFixed(3):'ei geometriaa'
    ]));
  }catch(error){
    root.replaceChildren(el('h2','PDF.js-käsittely epäonnistui'),el('p',String(error?.message||error),'status bad'));
  }
}
document.getElementById('realPdf').addEventListener('click',nativePdfRun);
