import {parseDelimited} from '../../src/csv.mjs';
import {parseHoldingsCsv} from '../../src/holdings.mjs';
import {inspectReadOnlyHandoff} from '../reader-bridge-v1/bridge.mjs';
import {parseNumber} from '../../src/numbers.mjs';
import {base,observation} from '../source-evidence-v1/fixtures.mjs';
export const labels={payDate:'Maksupäivä',grossPay:'Bruttotulo',netPay:'Nettopalkka',ytdTaxableIncome:'Veronalainen kertymä',quantity:'Määrä',buyPrice:'Hankintahinta',currency:'Valuutta',name:'Instrumentti',account:'Tili'};
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export function makeModel(layout,fields,format,notes=[]){
 return {original:freeze(structuredClone({layout,fields})),format,notes:[...notes],edits:{}};
}
export function csvModel(text){
 const table=parseDelimited(text),parsed=parseHoldingsCsv(table);
 if(table.observations.length>10000)throw new Error('CSV sisältää yli 10 000 solua. Rajaa synteettinen koe pienemmäksi.');
 const layout={sourceKind:'csv',observations:table.observations.map(o=>({...o,page:1})),pages:[],unplacedObservations:[],issues:table.issues};
 const fields={};
 parsed.records.forEach((r,i)=>{for(const [key,f]of Object.entries(r.fields))if(['quantity','buyPrice','currency','name','account'].includes(key)){
  const id='row'+(i+1)+':'+key;
  fields[id]={...f,semanticKey:key,status:f.status==='valid'?'verified':f.status,
   sourceIds:[f.observationId],sourceRoles:{valueIds:[f.observationId],headerIds:[],contextIds:[]}};
 }});
 return makeModel(layout,fields,'CSV',['Sarakkeiden tulkinta on ehdotus. Nykykurssia ja nykyarvoa ei tueta tässä CSV-adapterissa. Tuntemattomat solut säilyvät lähdelistassa.',...parsed.issues.map(i=>i.code)]);
}
export function review(model){
 const fields=structuredClone(model.original.fields);
 for(const [key,edit]of Object.entries(model.edits)){
  if(!fields[key])throw new Error('Tuntematon korjattava kenttä.');
  const old=fields[key],value=typeof old.value==='number'?parseNumber(edit.value):{status:edit.value.trim()?'valid':'missing',value:edit.value.trim()};
  if(value.status!=='valid')throw new Error('Korjauksen luku tai teksti on puuttuva, virheellinen tai epäselvä.');
  fields[key]={...old,value:value.value,status:'verified',sourceRoles:{valueIds:edit.valueIds,headerIds:edit.headerIds,contextIds:edit.contextIds},
   sourceIds:[...edit.valueIds,...edit.headerIds,...edit.contextIds]};
  if(edit.currency)fields[key].context={currency:edit.currency};else delete fields[key].context;
 }
 return {fields,result:inspectReadOnlyHandoff(model.original.layout,fields)};
}
export function sourceLabel(o){return o.kind==='cell'?`CSV lähderivi ${o.sourceLine}, solu R${o.row}C${o.column}`:`Sivu ${o.page} · ${o.id}`;}
export function normalizeOcrTsv(tsv){
 const s=String(tsv??'').replace(/^\uFEFF/,'').replace(/\r/g,'');
 if(s.startsWith('level\t'))return s;
 const rows=s.split('\n').filter(l=>l.trim());
 if(!/^1\t\d+\t/.test(rows[0]??'')||rows.some(l=>l.split('\t').length!==12||!/^[1-5]$/.test(l.split('\t')[0])))throw new Error('OCR:n TSV-muotoa ei voitu vahvistaa.');
 return 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+s;
}
export function exampleModel(kind){
 const c=base();let note='';
 if(kind==='heading'){c.layout.observations.push(observation('head','Payment date',.1,.2));c.parsed.fields.payDate.sourceIds.push('head');note='Otsikko ja päivämäärä: nimeä value=date ja header=head. Lähteen arvoa ei saa keksiä.';}
 if(kind==='global'){c.layout.observations.push(observation('ctx','EUR',.55,.06));Object.assign(c.parsed.fields.grossPay,{sourceRoles:{valueIds:['gross'],headerIds:[],contextIds:['ctx']},sourceIds:['gross','ctx'],context:{currency:'EUR'}});note='Yleinen valuuttakonteksti on eri rivillä. Nykyinen portti ei vahvista dokumenttitason kontekstia.';}
 if(kind==='column'){c.layout.observations.push(observation('head','Gross pay',.4,.1));Object.assign(c.parsed.fields.grossPay,{sourceRoles:{valueIds:['gross'],headerIds:['head'],contextIds:[]},sourceIds:['gross','head']});note='Etäinen sarakeotsikko vaatii tuetun sarakekohtaisen sidonnan. Sitä ei arvata.';}
 if(kind==='metadata'){c.layout.observations.push(observation('meta','Archive copy 7042',.1,.06));note='Tuntematon arkistomerkintä voi olla turha hälytys. Näkymä ei poista sitä automaattisesti. YÖAJO 09:n käytettävyysraja on edelleen FAIL.';}
 return makeModel({...c.layout,issues:[],unplacedObservations:[],pages:[]},c.parsed.fields,'Lähderoolikoe',[note]);
}
