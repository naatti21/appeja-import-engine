// Domain-neutral, conservative geometric row/cell proposal. Raw observations immutable.
const numeric=s=>/^[+\-−]?[\d\s.,:/%\-–—]+$/u.test(s.trim());
const cx=t=>(t.box.x0+t.box.x1)/2;
const cy=t=>(t.box.y0+t.box.y1)/2;
const h=t=>t.box.y1-t.box.y0;

// Syntactic fragments only. No currency dictionary, domain terms, IDs or truth values.
const shortSuffix=s=>/^[\p{L}%°µμ€$£¥/]{1,8}$/u.test(s.trim());
function singleNumericRun(tokens,page){
 if(tokens.length===1)return /\d/.test(tokens[0].raw);
 if(!tokens.length||!/^[-+]?\d{1,3}$/.test(tokens[0].raw.trim()))return false;
 for(let i=1;i<tokens.length;i++){
  if(!/^\d{3}(?:[,.]\d{1,2})?$/.test(tokens[i].raw.trim()))return false;
  if(tokens[i].box.x0-tokens[i-1].box.x1>Math.max(h(tokens[i]),h(tokens[i-1]))*page.height/page.width*1.5)return false;
 }
 return true;
}
function splitLocalPairs(group,page){
 const parts=[];let i=0;
 while(i<group.length){
  if(numeric(group[i].raw))return [group];
  const start=i++;const values=[];
  while(i<group.length&&numeric(group[i].raw))values.push(group[i++]);
  if(!singleNumericRun(values,page))return [group];
  parts.push(group.slice(start,i));
 }
 return parts.length>1?parts:[group];
}
function enrich(original,layout){
 const byId=new Map(layout.observations.map(o=>[o.id,o]));
 const area=ids=>{
  const obs=ids.map(id=>byId.get(id)).filter(o=>o?.box);
  return obs.length?{x0:Math.min(...obs.map(o=>o.box.x0)),y0:Math.min(...obs.map(o=>o.box.y0)),x1:Math.max(...obs.map(o=>o.box.x1)),y1:Math.max(...obs.map(o=>o.box.y1))}:null;
 };
 const records=[],columnCandidates=[];
 for(const page of layout.pages){
  for(const row of page.rows){
   const tokens=row.tokenIds.map(id=>byId.get(id));
   const values=tokens.filter(t=>numeric(t.raw));
   const last=values.at(-1),suffix=last?tokens.slice(tokens.indexOf(last)+1).filter(t=>shortSuffix(t.raw)):[];
   const rec={id:`record-${records.length+1}`,page:page.page,box:area(row.tokenIds),region_id:row.region_id,table_id:null,
    row_id:row.id,source_ids:row.tokenIds,original_row_ids:row.original_row_ids,status:'unresolved',
    unit_candidates:suffix.map(t=>({source_ids:[t.id],raw:t.raw,box:t.box,status:'uncertain',reason:'Short text suffix; no semantic unit interpretation'}))};
   // Column relationship is evaluated separately, never substituted for a row's text label.
   if(values.length){
    const headers=page.rows.filter(r=>r.y<row.y&&row.y-r.y<Math.max(...tokens.map(h))*15&&r.region_id===row.region_id&&r.tokenIds.length>=3&&r.tokenIds.every(id=>!numeric(byId.get(id).raw))).sort((a,b)=>b.y-a.y);
    const header=headers[0];
    if(header){
     rec.table_id=`table-${page.page}-${header.id}`;
     for(const value of tokens){
      const hs=header.tokenIds.map(id=>byId.get(id)).filter(t=>Math.abs(t.box.x0-value.box.x0)<=Math.max(h(t),h(value))*page.height/page.width*2);
      if(hs.length)columnCandidates.push({id:`column-${columnCandidates.length+1}`,page:page.page,box:area([...hs.map(t=>t.id),value.id]),region_id:row.region_id,table_id:rec.table_id,record_id:rec.id,
       row_id:row.id,source_ids:[...hs.map(t=>t.id),value.id],label_source_ids:hs.map(t=>t.id),value_source_ids:[value.id],unit_source_ids:[],status:'uncertain',method:'column-alignment',reason:hs.length===1?'Single aligned header, but no validated table grid':'Multiple geometric header alternatives'});
     }
    }
   }
   records.push(rec);
  }
 }
 const cells=layout.structure.cells.map(c=>{
  const source_ids=[...new Set(c.source_ids)],box=area(source_ids);
  const record=records.find(r=>source_ids.every(id=>r.source_ids.includes(id)));
  const state=c.status==='unverified'?'uncertain':c.status??'unresolved';
  return {...c,source_ids,box,status:state,region_id:c.region_id??null,table_id:record?.table_id??null,record_id:record?.id??null,
   record_candidate_ids:records.filter(r=>source_ids.some(id=>r.source_ids.includes(id))).map(r=>r.id),
   unit_source_ids:c.unit_source_ids??[],label_source_ids:c.label_source_ids??[],value_source_ids:c.value_source_ids??[],
   reason:c.reason??'Geometric multiline proposal; fragments remain separate'};
 });
 return {...layout,structure:{...layout.structure,cells,records,column_header_candidates:columnCandidates,
  schema_version:1,states:['unambiguous','uncertain','conflicting','unresolved'],certainty_scope:'Unambiguous refers only to the structural heuristic, not domain semantics or calibrated probability'}};
}

export function structureLayoutE(input){
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
      const cards=ts.filter(t=>/\s/.test(t.raw.trim())).length>=2&&allText&&ts.length>=2&&ts.length<=4&&ts.every(t=>t.box.x1-t.box.x0>3*fontX)&&ts.slice(1).every((t,i)=>t.box.x0-ts[i].box.x1>3*fontX);
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
        const pairs=splitLocalPairs(group,page);
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
        if(candidates.length>1){const ids=candidates.flatMap(c=>c.r.tokenIds);events.push({kind:'ambiguous-vertical-link',label_source_ids:row.tokenIds,value_source_ids:ids,status:'unverified'});cells.push({id:`cell-${cells.length+1}`,page:page.page,region_id:row.region_id,label_source_ids:row.tokenIds,value_source_ids:ids,source_ids:[...row.tokenIds,...ids],method:'vertical-competing',status:'uncertain',reason:'Multiple nearby value rows compete'});}
        if(next){
          const ns=next.r.tokenIds.map(id=>byId.get(id));
          const gap=next.r.y-row.y;
          if(gap>0&&gap<=Math.max(...ts.concat(ns).map(h))*3.5&&ns.every(t=>numeric(t.raw))&&singleNumericRun(ns,page)){
            const ids=[...row.tokenIds,...next.r.tokenIds];used.add(next.j);
            combined.push({...row,tokenIds:ids,original_row_ids:[...row.original_row_ids,...next.r.original_row_ids]});
            cells.push({id:`cell-${cells.length+1}`,page:page.page,region_id:row.region_id,label_source_ids:row.tokenIds,value_source_ids:next.r.tokenIds,source_ids:ids,method:'vertical-local',status:'unambiguous',reason:'One nearby numeric run in the same region'});
            continue;
          }
        }
      }
      combined.push(row);
      // Keep multi-value rows intact; scalar links are a separate derived assertion.
      const firstNumber=ts.findIndex(t=>numeric(t.raw));
      const values=ts.filter(t=>numeric(t.raw));
      if(values.length){
        const labels=firstNumber>0?ts.slice(0,firstNumber):[];
        const suffix=ts.slice(ts.lastIndexOf(values.at(-1))+1);
        const scalar=firstNumber===1&&singleNumericRun(values,page)&&suffix.every(t=>shortSuffix(t.raw));
        cells.push({id:`cell-${cells.length+1}`,page:page.page,region_id:row.region_id,
          label_source_ids:labels.map(t=>t.id),value_source_ids:values.map(t=>t.id),source_ids:row.tokenIds,
          unit_source_ids:suffix.filter(t=>shortSuffix(t.raw)).map(t=>t.id),
          method:scalar?'horizontal-local':'multi-value-row',status:scalar?'unambiguous':'uncertain',
          reason:scalar?'One lexical numeric run after one label; suffix retained as unit candidate':'Multiple values or non-scalar record; row label is not a column header'});
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
  return enrich(input,{...input,pages,structure:{regions,cells,events,limitations:['No page-to-page continuation binding','No merged-cell grid','Multiline links remain uncertain proposals','Column alignment is a hypothesis, not a verified link']}});
}
