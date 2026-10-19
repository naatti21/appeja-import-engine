/** Fictional structural analogues only: not bank screenshots or bank compatibility claims. */
export function brokerFundFixture(layout='compact'){
 const width=1100,height=layout==='compact'?800:2380,drawing=[];
 const add=(text,x,y,size=28)=>drawing.push({text,x,y,size});
 add('SYNTEETTINEN TESTIKUVA',40,45,22);add('Rahastot',40,110,36);add('Tili: FICTIONAL-A',40,155,24);
 const names=layout==='compact'?['Cedar Valley Sustainable Index']:['Cedar Valley Index','Lunar Meadow Bond','Birch Ocean Global','Maple Ridge Balanced','Willow Atlas Select'];
 const oracle=names.map((name,i)=>({name,quantity:layout==='compact'?'37.6':`${31+i}.25`,value:`${2300+i*110}.50`,nav:layout==='compact'?null:`${52+i}.1846`,averageAcquisitionPrice:layout==='compact'?null:`${41+i}.6258`}));
 for(const [i,row] of oracle.entries()){
  const y=220+i*410;
  if(layout==='compact'){
   add('Cedar Valley Sustainable',40,y,32);add('Index',40,y+40,32);
   add(row.value.replace('.',',')+' EUR',680,y+15,30);add(row.quantity.replace('.',',')+' kpl',680,y+65,28);
  }else{
   add(row.name,40,y,32);
   add('Arvo',40,y+65,24);add(row.value.replace('.',',')+' EUR',40,y+105,30);
   add(row.quantity.replace('.',',')+' kpl',680,y+105,30);
   add('NAV',40,y+175,24);add(row.nav.replace('.',',')+' EUR',40,y+215,30);
   add('Keskikurssi',650,y+200,24);add(row.averageAcquisitionPrice.replace('.',',')+' EUR',650,y+240,30);
   add('Tuotto +4,8 %',40,y+290,24);add('Päivän muutos -0,3 %',650,y+290,24);add('16.10.2026',40,y+325,22);
  }
 }
 const observations=drawing.map((d,i)=>({id:`broker-${i}`,raw:d.text,ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:d.x/width,y0:(d.y-d.size*.75)/height,x1:(d.x+d.text.length*d.size*.48)/width,y1:d.y/height}}}));
 return {width,height,drawing,oracle,source:{observations,issues:[],canPersist:false}};
}
