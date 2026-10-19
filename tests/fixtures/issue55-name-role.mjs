/**
 * Issue #55: only fictional portfolio data.
 * The source-level fixture intentionally excludes the faint issuer from OCR
 * observations. The browser variant separately draws it as near-white pixels.
 * No market lookup, user data, production settings or persistence.
 */
export function issue55Fixture({mode='clean'}={}) {
  if (!['clean','faint','absent'].includes(mode)) throw Error('INVALID_MODE');
  const width=1000,height=1250,drawing=[],observations=[];
  const holdings=[
    {name:'Amber Circuit',quantity:12,cents:10100,y:360},
    {name:'Copper Harbor',quantity:8,cents:20100,y:640},
    {name:'Silver Orchard',quantity:7,cents:30900,y:910},
  ];
  function add(raw,x,y,{color='#000000',widthHint=Math.min(raw.length*13,360),observed=true}={}) {
    drawing.push({text:raw,x,y,color});
    if (!observed) return;
    observations.push({
      id:'issue55-'+observations.length,
      raw,ocrConfidence:99,
      source:{format:'image-ocr',page:1,
        box:{x0:x/width,x1:(x+widthHint)/width,
          y0:(y-21)/height,y1:(y+3)/height}}
    });
  }
  add('Investments',40,70);
  add('Total value 630,00 EUR',40,110);
  add('Available balance',40,150);
  add('19,00 EUR',40,185);
  add('Stocks',40,240);
  for(const [index,item] of holdings.entries()) {
    if(index===0&&mode!=='clean') {
      if(mode==='faint') add(item.name,40,320,{color:'#fafafa',observed:false});
      add('Growth bucket',40,item.y);
    } else add(item.name,40,item.y);
    add((item.cents/100).toFixed(2).replace('.',',')+' EUR',650,item.y,{widthHint:210});
    add(item.quantity+' kpl',735,item.y+45,{widthHint:150});
  }
  return {mode,width,height,drawing,oracle:holdings.map(({name,quantity,cents})=>({name,quantity,cents})),
    source:{schemaVersion:1,observations,issues:[],canPersist:false}};
}
