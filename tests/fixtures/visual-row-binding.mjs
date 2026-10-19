/** Fictional adversarial layout: headings and real names deliberately compete. */
export function rowBindingFixture({attack=true}={}) {
 const width=800,height=1440,drawing=[],observations=[];
 function add(text,x,y,w=Math.min(text.length*12,340)) {
  drawing.push({text,x,y});
  observations.push({id:'binding-'+observations.length,raw:text,ocrConfidence:99,
   source:{format:'image-ocr',page:1,box:{x0:x/width,x1:(x+w)/width,y0:(y-21)/height,y1:(y+3)/height}}});
 }
 add('Investments',40,70);add('Total value 1020,00 EUR',40,110);
 add('Available balance',40,150);add('0,00 EUR',40,185);
 add('Stocks',40,230);
 const names=['Copper Valley','Winter Harbor','Silver Forest','Clear River'];
 const headings=['Growth sleeve','Income sleeve','Reserve sleeve'];
 const oracle=names.map((name,i)=>({name,quantity:[12,7,10,13][i],cents:[10100,20300,30700,40900][i]}));
 oracle.forEach((o,i)=>{
  const y=320+i*220;
  if(attack&&i<3){add(o.name,40,y-45);add(headings[i],40,y);}
  else add(o.name,40,y);
  add((o.cents/100).toFixed(2).replace('.',',')+' EUR',510,y,200);add(o.quantity+' kpl',620,y+32,130);
 });
 return {width,height,drawing,oracle,headings,source:{schemaVersion:1,observations,issues:[],canPersist:false}};
}
