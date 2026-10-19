/** Work P1-65-01 exact fictional source plus independent role controls. */
export function economicRoleFixture(mode='dated-nav'){
 const drawing=[{text:'Rahastot',x:40,y:110,size:36},{text:'Cedar Valley Index',x:40,y:220,size:32}];
 const labels={'unknown-context':'Indikatiivinen tieto','above-name':'NAV 16.10.2026','dated-nav':'NAV 16.10.2026','plain-nav':'NAV','separate-date':'NAV','dated-gav':'Keskikurssi 2026-10-16','day-change':'Päivän muutos 16.10.2026','generic-price':'Osuuden hinta 16.10.2026','conflicting':'NAV / Arvo 16.10.2026'};
 if(labels[mode])drawing.push({text:labels[mode],x:680,y:mode==='above-name'?195:225,size:24});
 if(mode==='separate-date')drawing.push({text:'16.10.2026',x:680,y:255,size:20});
 if(mode==='return-near-value')drawing.push({text:'Tuotto +4,8 %',x:40,y:265,size:24});
 drawing.push({text:'52,1846 EUR',x:680,y:mode==='separate-date'?295:265,size:30},{text:'37,6 kpl',x:680,y:mode==='separate-date'?335:315,size:28});
 const width=1100,height=1000;
 const observations=drawing.map((d,i)=>({id:'economic-'+i,raw:d.text,ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:d.x/width,y0:(d.y-d.size*.75)/height,x1:(d.x+d.text.length*d.size*.45)/width,y1:d.y/height}}}));
 return {width,height,drawing,source:{observations,issues:[],canPersist:false},expectValue:['unlabelled-value','return-near-value'].includes(mode)};
}
