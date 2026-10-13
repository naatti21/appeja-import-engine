// Domain-neutral, conservative geometric row/cell proposal. Raw observations immutable.
const numeric=s=>/^[+\-−]?[\d\s.,:/%\-–—]+$/u.test(s.trim());
const cx=t=>(t.box.x0+t.box.x1)/2;
const cy=t=>(t.box.y0+t.box.y1)/2;
const h=t=>t.box.y1-t.box.y0;
export function structureLayout(input){
  const byId=new Map(input.observations.map(o=>[o.id,o]));
  const regions=[],cells=[],events=[];
  const pages=input.pages.map(page=>{
    const rows=[];
    let active=null;
    for(const original of page.rows){
      const ts=original.tokenIds.map(id=>byId.get(id));
      if(!ts.length)continue;
      const allText=ts.every(t=>!numeric(t.raw));
      const half=ts.length/2;
      // Repeated header sequence establishes two distinct table regions, using glyph gaps.
      const repeated=allText&&ts.length>=4&&ts.length%2===0&&ts.slice(0,half).every((t,i)=>t.raw.trim()===ts[i+half].raw.trim());
      const height=Math.max(...ts.map(h));
      const fontX=height*page.height/page.width;
      // Card headers: long separated text runs. No document-type or vocabulary check.
      const cards=allText&&ts.length>=2&&ts.length<=4&&ts.every(t=>t.box.x1-t.box.x0>3*fontX)&&ts.slice(1).every((t,i)=>t.box.x0-ts[i].box.x1>3*fontX);
      if(repeated||cards){
        const cuts=repeated?[(ts[half-1].box.x1+ts[half].box.x0)/2]:ts.slice(1).map((t,i)=>(cx(ts[i])+cx(t))/2);
        active={id:`p${page.page}-region-${regions.length+1}`,page:page.page,cuts,start_y:original.y,last_y:original.y,height};
        regions.push(active);events.push({kind:repeated?'repeated-table-header':'separated-card-header',source_ids:original.tokenIds,region_id:active.id});
      }else if(active&&original.y-active.last_y>Math.max(0.075,active.height*5))active=null;
      const groups=active?Array.from({length:active.cuts.length+1},()=>[]):[ts];
      if(active){for(const t of ts){const index=active.cuts.filter(c=>cx(t)>c).length;groups[index].push(t);}active.last_y=original.y;}
      for(let gi=0;gi<groups.length;gi++){
        const group=groups[gi];if(!group.length)continue;
        // Split multiple same-line label/value pairs; do not split numeric-leading table rows.
        const pairs=[];let current=[];let sawNumber=false;
        for(const t of group){
          if(!numeric(group[0].raw)&&current.length&&sawNumber&&!numeric(t.raw)){
            pairs.push(current);current=[];sawNumber=false;
          }
          current.push(t);if(numeric(t.raw))sawNumber=true;
        }
        if(current.length)pairs.push(current);
        for(const pair of pairs){
          rows.push({id:`${original.id}-s${rows.length+1}`,page:page.page,y:original.y,tokenIds:pair.map(t=>t.id),region_id:active?`${active.id}-c${gi}`:null,original_row_ids:[original.id]});
        }
      }
    }
    // Attach a nearby single label to the next all-numeric cell in the same inferred region.
    // Header/value gaps measured relative to font height; ambiguity retains original rows.
    const used=new Set(),combined=[];
    for(let i=0;i<rows.length;i++){
      if(used.has(i))continue;
      const row=rows[i],ts=row.tokenIds.map(id=>byId.get(id));
      if(row.region_id&&ts.every(t=>!numeric(t.raw))&&ts.length===1){
        const following=rows.map((r,j)=>({r,j})).filter(({r,j})=>j>i&&!used.has(j)&&r.region_id===row.region_id);
        const candidates=[];
        for(const item of following){
          const its=item.r.tokenIds.map(id=>byId.get(id));
          if(its.some(t=>!numeric(t.raw))||item.r.y-row.y>Math.max(...ts.concat(its).map(h))*3.5)break;
          candidates.push(item);
        }
        const next=candidates.length===1?candidates[0]:null;
        if(candidates.length>1)events.push({kind:'ambiguous-vertical-link',label_source_ids:row.tokenIds,value_source_ids:candidates.flatMap(c=>c.r.tokenIds),status:'unverified'});
        if(next){
          const ns=next.r.tokenIds.map(id=>byId.get(id));
          const gap=next.r.y-row.y;
          if(gap>0&&gap<=Math.max(...ts.concat(ns).map(h))*3.5&&ns.every(t=>numeric(t.raw))){
            const ids=[...row.tokenIds,...next.r.tokenIds];used.add(next.j);
            combined.push({...row,tokenIds:ids,original_row_ids:[...row.original_row_ids,...next.r.original_row_ids]});
            cells.push({id:`cell-${cells.length+1}`,page:page.page,region_id:row.region_id,label_source_ids:row.tokenIds,value_source_ids:next.r.tokenIds,source_ids:ids,method:'vertical-local'});
            continue;
          }
        }
      }
      combined.push(row);
      // Preserve horizontal label/value associations as explicit structural output.
      const firstNumber=ts.findIndex(t=>numeric(t.raw));
      if(firstNumber>0&&ts.slice(firstNumber).every(t=>numeric(t.raw))){
        cells.push({id:`cell-${cells.length+1}`,page:page.page,region_id:row.region_id,label_source_ids:ts.slice(0,firstNumber).map(t=>t.id),value_source_ids:ts.slice(firstNumber).map(t=>t.id),source_ids:row.tokenIds,method:'horizontal-local'});
      }
    }
    // Multiline fragments are retained as proposals, not greedily merged into semantic rows.
    for(let i=1;i<combined.length;i++){
      const a=combined[i-1],b=combined[i],as=a.tokenIds.map(id=>byId.get(id)),bs=b.tokenIds.map(id=>byId.get(id));
      if(bs.every(t=>!numeric(t.raw))&&b.y-a.y<=Math.max(...as.concat(bs).map(h))*1.5&&Math.abs(bs[0].box.x0-as[0].box.x0)<0.01){
        cells.push({id:`cell-${cells.length+1}`,page:page.page,source_ids:[...a.tokenIds,...b.tokenIds],method:'multiline-proposal',status:'unverified'});
      }
    }
    return {...page,rows:combined};
  });
  return {...input,pages,structure:{regions,cells,events,limitations:['No page-to-page continuation binding','No merged-cell grid','Multiline links remain unverified proposals']}};
}
