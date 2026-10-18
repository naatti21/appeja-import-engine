/** Entirely fictional screenshot layout; no personal document or user's holdings. */
export function visualLedgerFixture({crop=false,missingAmount=false,wrongTotal=false,mixedCurrency=false,weakName=false}={}) {
 const width=760,height=1440,observations=[],drawing=[];
 let n=0;
 function add(text,x,y,w=null,confidence=98) {
  drawing.push({text,x,y});
  const span=w??Math.min(text.length*11,width-x-20);
  observations.push({id:'synthetic'+(++n),raw:text,method:'synthetic',
   ocrConfidence:confidence,source:{format:'image-ocr',page:1,
    box:{x0:x/width,x1:(x+span)/width,y0:(y-21)/height,y1:(y+4)/height}}});
 }
 if(!crop){
  add('Säästä ja sijoita',60,55);
  add('Sijoitukset',65,120);
  add('Arvo yhteensä 1 530,00 EUR',65,160);
  add('Käytettävissä oleva saldo',65,205);
  add('13,40 EUR',65,241);
  add('Arvonmuutos',65,285);add('+18,00 % (+201,10 EUR)',65,312);
  add('Arvonmuutos 1 päivä',65,350);add('-0,60 % (-9,18 EUR)',65,380);
  add('Suodata tuloksia',65,420);add('Muutos Kurssi Omistus',65,458);
 }
 add('Osakkeet',65,490);
 const stocks=[
  ['Quartz Devices',101.25,4],
  ['Windswept Energy',202.50,17],
  ['Arbor Financial',303.75,31],
  ['Kite Commerce',404.00,92]
 ];
 const fmt=c=>c.toFixed(2).replace('.',',')+' EUR';
 for(let i=0;i<stocks.length;i++){
  const [name,amount,qty]=stocks[i],y=538+i*111;
  add(name,65,y,320,weakName&&i===1?30:98);
  if(!(missingAmount&&i===2))add(fmt(amount),505,y,200);
  add(qty+' kpl',588,y+28,105);
 }
 add('Rahastot',65,1000);
 add('Northland Index Select',65,1048,320);
 add('505,10 EUR',505,1048,200);
 add('A',65,1079,52);
 add('12,5 kpl',588,1079,110);
 if(!crop){
  add('Säästötilit',65,1166);
  add('Arvo yhteensä 2 550,00 EUR',65,1202);
  add('Katsaus Maksa Sijoita Tuki',65,1300);
 }
 if(wrongTotal)observations.find(o=>o.raw.startsWith('Arvo yhteensä 1')).raw='Arvo yhteensä 1 530,01 EUR';
 if(mixedCurrency)observations.find(o=>o.raw==='404,00 EUR').raw='404,00 USD';
 return {source:{schemaVersion:1,sourceKind:'image-ocr-tsv',observations,issues:[],canPersist:false},
  width,height,drawing,
  oracle:[...stocks.map(([name,amount,qty])=>({kind:'stock',name,qty,cents:Math.round(amount*100)})),
   {kind:'fund',name:'Northland Index Select A',qty:12.5,cents:50510}]};
}
