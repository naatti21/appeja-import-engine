/** Entirely fictional layouts, amounts and names; no bank screenshot is reproduced. */
export function fundSnapshotFixture(layout='compact') {
 const width=1100,height=layout==='compact'?780:2300,drawing=[];
 const add=(text,x,y,size=28)=>drawing.push({text,x,y,size});
 add('SYNTEETTINEN TESTIKUVA',40,50,24);
 add('Nykyiset omistukset',40,110,36);add('Tili: TEST-A',40,155,24);
 const names=layout==='compact'?['Juniper Horizon Sustainable Index']:['Cedar Valley Index','Lunar Meadow Bond','Birch Ocean Global','Maple Ridge Balanced','Willow Atlas Select'];
 const oracle=names.map((name,i)=>({name,quantity:layout==='compact'?'49.7':`${21+i}.25`,value:`${1000+i*100}.50`,nav:layout==='compact'?null:`${40+i}.1234`,averageAcquisitionPrice:layout==='compact'?null:`${35+i}.5678`}));
 for(const [i,row] of oracle.entries()){
  const y=layout==='compact'?220:220+i*410;
  add('Rahasto',40,y,24);
  if(layout==='compact'){add('Juniper Horizon Sustainable',40,y+45,32);add('Index',40,y+85,32);}else add(row.name,40,y+45,32);
  add('Arvo',40,y+130,24);add(row.value.replace('.',',')+' EUR',40,y+165,30);
  add('Osuudet yhteensä',layout==='compact'?40:540,y+(layout==='compact'?225:130),24);add(row.quantity.replace('.',',')+' kpl',layout==='compact'?40:540,y+(layout==='compact'?260:165),30);
  if(layout!=='compact'){
   add('NAV',40,y+225,24);add(row.nav.replace('.',',')+' EUR',40,y+260,30);
   add('Keskihankintahinta',540,y+225,24);add(row.averageAcquisitionPrice.replace('.',',')+' EUR',540,y+260,30);
   add('Tuotto 5,4 %',40,y+310,24);add('Päivän muutos -0,2 %',540,y+310,24);add('15.10.2026',40,y+345,22);
  }
 }
 // Deterministic geometry evidence for independent parser adversaries; browser tests use pixels instead.
 const observations=drawing.map((d,i)=>({id:`s${i}`,raw:d.text,source:{format:'image-ocr',page:1,box:{x0:d.x/width,y0:(d.y-d.size)/height,x1:(d.x+Math.min(500,d.text.length*d.size*.5))/width,y1:d.y/height}},ocrConfidence:99}));
 return {width,height,drawing,oracle,source:{observations,issues:[],canPersist:false}};
}

export function fundDetailFixture(){
 const f=fundSnapshotFixture('compact');
 f.drawing[1].text='Rahaston tiedot';
 f.drawing=f.drawing.filter(d=>!['Arvo','1000,50 EUR','Osuudet yhteensä','49,7 kpl'].includes(d.text));
 f.drawing.push({text:'Keskihankintahinta',x:40,y:420,size:24},{text:'19,1234 EUR',x:40,y:460,size:30});
 // Detail fixture is deliberately pixel-only; tests do not supply canned detail OCR.
 delete f.source;return f;
}
