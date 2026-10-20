/** New fictional controls: no bank image or real portfolio data. */
export function roleControlFixture(mode='five'){
 const width=1100,height=mode==='one'?800:1500,drawing=[];
 const add=(text,x,y,size=28)=>drawing.push({text,x,y,size});
 add('Rahastot',40,110,36);
 const names=['Value Meadow Index','Price Harbor Fund','Cedar Valley Index','Lunar Meadow Bond','Birch Ocean Global'];
 const count=mode==='one'?1:mode==='five'?5:2;
 const oracle=[];
 for(let i=0;i<count;i++){
  const y=220+i*240,value=`${2300+i*110}.50`,quantity=`${31+i}.25`;
  add(names[i],40,y,32);add(value.replace('.',',')+' EUR',680,y+45,30);add(quantity.replace('.',',')+' kpl',680,y+95,28);
  oracle.push({name:names[i],value,quantity,withheld:false});
 }
 if(mode==='cross-conflict'||mode==='cross-control'){
  // A trailing label in card 1 must not borrow the next card's monetary token.
  add('NAV 18.10.2026',790,380,24);
  if(mode==='cross-control')add('52,1846 EUR',680,415,30);
  else oracle[1].withheld=true;
 }
 drawing.sort((a,b)=>a.y-b.y||a.x-b.x);
 const observations=drawing.map((d,i)=>({id:`control-${i}`,raw:d.text,ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:d.x/width,y0:(d.y-d.size*.75)/height,x1:(d.x+d.text.length*d.size*.45)/width,y1:d.y/height}}}));
 return {width,height,drawing,oracle,source:{observations,issues:[],canPersist:false}};
}
