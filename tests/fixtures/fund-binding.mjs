/** Work P1-64-01 oracle. Fictional pixels, unchanged geometry and numbers. */
export function fundBindingFixture(staggered=true){
 const width=1100,height=1000;
 const drawing=[['Nykyiset omistukset',40,80,36],['Rahasto',40,150,24],['Cedar Valley Index',40,195,32],['Osuudet yhteensä',40,260,24],['37,6 kpl',40,295,28],['Arvo',600,260,24],['1962,14 EUR',600,295,28],['NAV',600,390,24],['Keskihankintahinta',40,staggered?415:390,24],['52,1846 EUR',600,442,28]].map(([text,x,y,size])=>({text,x,y,size}));
 const observations=drawing.map((d,i)=>({id:`binding-${i}`,raw:d.text,ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:d.x/width,x1:(d.x+d.text.length*d.size*.5)/width,y0:(d.y-d.size*.75)/height,y1:d.y/height}}}));
 return {width,height,drawing,source:{observations,issues:[],canPersist:false}};
}
