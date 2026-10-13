/**
 * Deterministic, fully synthetic multi-format QA cases with an independent value oracle.
 * Seeds/case IDs are stable across Node and Chromium. NO user-derived values.
 */
const LABELS={
 ticker:['Ticker','Symbol','Osaketunnus','Tunnus'],
 name:['Name','Nimi','Company','Yhtiö'],
 quantity:['Quantity','Shares','Qty','Kpl','Määrä'],
 buyPrice:['Buy Price','Keskihinta','Hankintahinta','Average Cost','GAV'],
 currency:['Currency','Valuutta'],
 account:['Account','Tili'],
 broker:['Broker','Välittäjä']
};
const KEYS=['ticker','name','quantity','buyPrice','currency','account','broker'];
const CURRENCIES=['EUR','USD','SEK','GBP','CHF'];
const NAMES=['Aster, Labs Oy','Imaginary & Co','Northwind "Beta"','Synteettinen Ääni Oy'];
export function seeded(seed){
 let x=(seed>>>0)||1;
 return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
}
export function pick(rng,list){return list[Math.floor(rng()*list.length)];}
function shuffle(rng,array){
 const out=[...array];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
function quote(cell,delimiter){
 const s=String(cell??'');
 return s.includes(delimiter)||s.includes('"')||s.includes('\n')
  ?'"'+s.replaceAll('"','""')+'"':s;
}
export function encodeCsv(rows,delimiter,newline,bom=false){
 return (bom?'\uFEFF':'')+rows.map(row=>row.map(c=>quote(c,delimiter)).join(delimiter)).join(newline)+newline;
}
export function makePortfolioCase(seed,index){
 const rng=seeded((seed^Math.imul(index+11,2654435761))>>>0);
 const delimiter=pick(rng,[',',';','\t']);
 const newline=pick(rng,['\n','\r\n']);
 const bom=rng()<0.25;
 const rowCount=1+Math.floor(rng()*3);
 const keys=shuffle(rng,KEYS.slice(0,5).concat(rng()<0.5?['account','broker']:[]));
 const labels=keys.map(key=>pick(rng,LABELS[key]));
 const expected=[];
 for(let i=0;i<rowCount;i++){
  const ticker='SYN'+String(seed%10000).padStart(4,'0')+String(index).padStart(4,'0')+i;
  const quantity=1+Math.floor(rng()*180);
  const buyPrice=Math.floor(rng()*50000)/100;
  const currency=pick(rng,CURRENCIES);
  const name=pick(rng,NAMES);
  expected.push({ticker,name,quantity,buyPrice,currency,account:'DEMO-'+(i%2+1),broker:'DEMO BROKER'});
 }
 const rows=[labels,...expected.map(v=>keys.map(k=>{
  if(k==='quantity')return String(v.quantity);
  if(k==='buyPrice')return v.buyPrice.toFixed(2).replace('.',rng()<0.5?',':'.');
  return v[k];
 }))];
 return {id:'seed-'+seed+'-case-'+index,seed,index,keys,labels,delimiter,newline,bom,expected,rows,
  csv:encodeCsv(rows,delimiter,newline,bom)};
}
export function mutatePortfolioCase(input,mode){
 const rows=input.rows.map(r=>[...r]),keys=[...input.keys];
 const getIndex=key=>keys.indexOf(key);
 const col=getIndex(mode==='duplicateHeader'?'ticker':
  mode==='missingBuyPrice'||mode==='ambiguousBuyPrice'?'buyPrice':
  mode==='missingCurrency'||mode==='badCurrency'?'currency':'quantity');
 switch(mode){
  case 'missingBuyPrice':rows[1][col]='';break;
  case 'ambiguousBuyPrice':rows[1][col]='1.234';break;
  case 'zeroQuantity':rows[1][col]='0';break;
  case 'negativeQuantity':rows[1][col]='-3';break;
  case 'missingCurrency':rows[1][col]='';break;
  case 'badCurrency':rows[1][col]='EURO';break;
  case 'duplicateHeader':
   keys.push('ticker');rows[0].push('Symbol');
   for(let i=1;i<rows.length;i++)rows[i].push(rows[i][getIndex('ticker')]);break;
  case 'unknownMaterial':
   keys.push('unknown');rows[0].push('Opaque metadata');
   for(let i=1;i<rows.length;i++)rows[i].push('123,45');break;
  case 'inconsistentWidth':rows[1].push('TRAILING');break;
  case 'brokenQuote':return {mode,expected:'throw',
   csv:input.csv.slice(0,-1)+'"Unterminated'};
  default:throw new Error('UNKNOWN_QA_MUTATION');
 }
 return {mode,expected:'block',csv:encodeCsv(rows,input.delimiter,input.newline,input.bom)};
}
export const NEGATIVE_MODES=[
 'missingBuyPrice','ambiguousBuyPrice','zeroQuantity','negativeQuantity',
 'missingCurrency','badCurrency','duplicateHeader','unknownMaterial','inconsistentWidth','brokenQuote'
];
export const QA_SEEDS=(process.env.QA_SEEDS??'17,43,97').split(',').map(x=>Number(x.trim())).filter(Number.isSafeInteger);
export const QA_CASES=Math.max(1,Math.min(1000,Number(process.env.QA_CASES??80)));
