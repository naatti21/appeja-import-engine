/** Test-only snapshot of Palkka PDF row folding (pdf-reader.js @ 550c7654…).
 * This measures geometry granularity ONLY, not the full Palkka semantic parser.
 */
export function pageItemsToLines(items,pageNumber){
  const rows=new Map();
  for(const item of items){
    if(!item.str?.trim())continue;
    const x=item.transform?.[4]??0;
    const y=item.transform?.[5]??0;
    const bucket=Math.round(y/2)*2;
    if(!rows.has(bucket))rows.set(bucket,[]);
    rows.get(bucket).push({x,text:item.str.trim(),width:item.width||0});
  }
  return [...rows.entries()]
    .sort((a,b)=>b[0]-a[0])
    .map(([y,parts])=>{
      parts.sort((a,b)=>a.x-b.x);
      return {text:parts.map(p=>p.text).join(' '),page:pageNumber,x:parts[0].x,
        y,width:Math.max(...parts.map(p=>p.x+p.width))-parts[0].x};
    }).filter(item=>item.text);
}
