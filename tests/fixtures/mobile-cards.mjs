// Independent fictional source/oracle data; never derived from a user's portfolio.
export function mobileFixture({layout='en',round=0,ambiguous=true,account='Practice-A',identity='ticker'}={}) {
  const people=[['Juniper Devices','QJPA',7],['Cobalt Systems','QCBT',13],['Maple Research','QMPL',19]];
  const names=people.map(([name,ticker,qty],i)=>({name:round?`${name} Series ${String.fromCharCode(65+round)}`:name,ticker,qty:qty+round*(i+2)}));
  if(identity==='isin')names.forEach((item,i)=>{
    const body='ZZ'+String(123456700+i+round*10);
    for(let check=0;check<10;check++){
      const candidate=body+check,digits=[...candidate].map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join('');
      const sum=[...digits].reverse().reduce((sum,c,index)=>{const n=Number(c)*(index%2?2:1);return sum+(n>9?n-9:n);},0);
      if(sum%10===0){item.isin=candidate;break;}
    }
  });
  const identityLine=(item,mic)=>item.isin?`ISIN: ${item.isin}`:`Ticker: ${item.ticker} MIC: ${mic}`;
  const groups=[['More'],[`Account: ${account}`]];
  for(const item of names){
    const title=ambiguous?['Research basket',item.name]:[item.name];
    groups.push(layout==='fi' ? [ ...title,`Määrä: ${item.qty} kpl`,identityLine(item,'XHEL'),'Currency: EUR','Arvo: 120,00 EUR','Päivän muutos: +2,00 %'] :
      [...title,identityLine(item,'XNAS'),`Quantity: ${item.qty}`,'Currency: USD','Current price: 12.00 USD','Day change: +2.00 %']);
  }
  groups.push(['Balance: 1000 EUR'],['Show sources']);
  const height=groups.reduce((sum,g)=>sum+g.length*36+60,50), width=760;
  let y=20, n=0;
  const observations=[], drawing=[];
  groups.forEach(group=>{group.forEach(text=>{
    drawing.push({text,x:30,y:y+24});
    observations.push({id:`s${++n}`,raw:text,method:'tesseract-tsv',ocrConfidence:98,
      source:{format:'image-ocr',page:1,box:{x0:30/width,x1:Math.min(.95,(30+text.length*12)/width),y0:y/height,y1:(y+24)/height}}});y+=36;
  });y+=60;});
  return {source:{sourceKind:'image-ocr-tsv',observations,issues:[],canPersist:false},oracle:names,groups,drawing,width,height};
}
