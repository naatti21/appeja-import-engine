/** Exact fictional Work P1-66-01 sources, independent controls; no bank data. */
export function offsetRoleFixture(mode='nav'){
 const width=1100,height=1000;
 const drawing=[{text:'Rahastot',x:40,y:110,size:36},{text:'Cedar Valley Index',x:40,y:220,size:32}];
 const gav=mode==='gav',amount=gav?'61,7254':'73,4826',quantity=gav?'28,2':'29,4';
 drawing.push({text:gav?'GAV 17.10.2026':'NAV 18.10.2026',x:mode==='left-offset'?590:790,y:225,size:mode==='wide-font'?30:24});
 drawing.push({text:amount+' EUR',x:680,y:265,size:30},{text:quantity+' kpl',x:680,y:315,size:28});
 const observations=drawing.map((d,i)=>({id:'offset-'+i,raw:d.text,ocrConfidence:99,source:{format:'image-ocr',page:1,box:{x0:d.x/width,y0:(d.y-d.size*.75)/height,x1:(d.x+d.text.length*d.size*.45)/width,y1:d.y/height}}}));
 return {width,height,drawing,source:{observations,issues:[],canPersist:false}};
}
