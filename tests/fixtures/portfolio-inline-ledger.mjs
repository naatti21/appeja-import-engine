/** Fully fictional word-positioned OCR screenshot of compact single-line stock rows. */
export function inlineLedgerFixture({dualMoney=false,changeTag=false,noSummary=false}={}){
 const width=800,height=1060,observations=[],drawing=[];
 let index=0;
 function word(text,x,y,w=text.length*12) {
  const id='inline-'+(++index);
  observations.push({id,raw:text,ocrConfidence:99,method:'synthetic',source:{
    format:'image-ocr',page:1,box:{x0:x/width,x1:Math.min((x+w)/width,.99),
      y0:(y-21)/height,y1:(y+3)/height}}});
  drawing.push({text,x,y});
 }
 if(!noSummary){
  word('Sijoitukset',38,70);
  word('Arvo yhteensä 360,00 EUR',38,120,350);
  word('Käytettävissä oleva saldo',38,163,330);
  word('10,00 EUR',38,200,155);
 }
 word('Osakkeet',38,245);
 const entries=[
  ['Silver Pine',50.00,4],
  ['Baltic Meadow',75.00,10],
  ['Cedar Tree',100.00,25]
 ];
 for(let i=0;i<entries.length;i++){
  const [name,value,qty]=entries[i],y=290+i*124;
  word(name,38,y,210);
  if(dualMoney && i===1){
    // Deliberately two competing monetary amounts on one holding row.
    word('15,00',376,y,64);word('EUR',440,y,47);
  }
  if(changeTag && i===1)word('Arvonmuutos',269,y,100);
  word(value.toFixed(2).replace('.',','),500,y,78);
  word('EUR',584,y,45);
  word(String(qty),661,y,36);
  word('kpl',708,y,42);
 }
 word('Rahastot',38,699);
 word('Evergreen Index A',38,744,242);
 word('125,00',500,744,78);word('EUR',584,744,45);
 word('5,5',661,744,36);word('kpl',708,744,42);
 word('Säästötilit',38,887);
 word('Arvo yhteensä 900,00 EUR',38,933,350);
 return {source:{schemaVersion:1,sourceKind:'image-ocr-tsv',observations,
   issues:[],canPersist:false},width,height,drawing,
   oracle:[...entries.map(([name,value,quantity])=>({name,kind:'stock',quantity,cents:value*100})),
     {name:'Evergreen Index A',kind:'fund',quantity:5.5,cents:12500}]};
}
