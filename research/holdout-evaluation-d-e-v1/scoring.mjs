const norm=s=>String(s??'').replace(/\s+/gu,'');
function inArea(o,f,ann,label=false){
  if(!o?.box||o.page!==f.page)return false;
  const bbox=label?f.label_bbox_pt:f.bbox_pt;if(!bbox)return false;
  const [w,h]=ann.page_sizes_pt[f.page-1],cx=(o.box.x0+o.box.x1)*w/2,cy=(o.box.y0+o.box.y1)*h/2;
  return cx>=bbox[0]-2&&cx<=bbox[2]+2&&cy>=bbox[1]-3&&cy<=bbox[3]+3;
}
function readerMatch(f,layout,ann){
  const items=layout.observations.filter(o=>inArea(o,f,ann)).sort((a,b)=>a.box.y0-b.box.y0||a.box.x0-b.box.x0);
  return {field_id:f.id,role:f.role,record:f.record,raw_expected:f.raw,located_raw:items.map(x=>x.raw).join(' '),
    raw_match:norm(items.map(x=>x.raw).join(' ')).includes(norm(f.raw)),source_ids:items.map(x=>x.id),
    split_across_items:!items.some(x=>norm(x.raw).includes(norm(f.raw)))};
}
function scoreCore(parsed,layout,ann){
  if(ann.document_type!=='payroll')return [];
  return Object.entries(ann.payroll_core).map(([key,t])=>{
    const truth=t.field_ids.map(id=>ann.fields.find(f=>f.id===id));const value=truth[0]?.value??null;
    const actual=parsed.fields[key];const refs=actual.sourceIds.map(id=>layout.observations.find(o=>o.id===id));
    const val=t.state==='known'&&actual.status==='verified'&&(typeof actual.value==='number'?actual.value===Number(value):actual.value===value);
    const vs=truth.some(f=>refs.some(o=>inArea(o,f,ann)));
    const ls=truth.some(f=>refs.some(o=>inArea(o,f,ann,true)));
    return {key,expected_state:t.state,expected_value:value,actual,correct_value:val,correct_value_source:val&&vs,correct_label_source:val&&ls,
      exact_core_match:val&&vs&&ls,correct_missing:t.state==='missing'&&actual.status==='missing'&&actual.value===null,
      source_refs_exist:refs.every(Boolean)};
  });
}
function scoreStructure(layout,ann){
  const byId=new Map(layout.observations.map(o=>[o.id,o]));
  const evaluations=[];
  for(const cell of (layout.structure?.cells??[]).filter(c=>c.value_source_ids)){
    const vals=cell.value_source_ids.map(id=>byId.get(id)),labels=cell.label_source_ids.map(id=>byId.get(id));
    const relevant=ann.fields.filter(f=>f.label_bbox_pt&&vals.some(o=>inArea(o,f,ann)));
    if(!relevant.length)continue; // GT does not define this proposed cell's header association.
    const correct=relevant.some(f=>labels.some(o=>inArea(o,f,ann,true))&&norm(vals.map(o=>o.raw).join(' ')).includes(norm(f.raw)));
    evaluations.push({cell_id:cell.id,relevant_field_ids:relevant.map(f=>f.id),correct});
  }
  // Repeated-table record separation only where the fixture actually defines a row record.
  const records=[...new Set(ann.fields.map(f=>f.record).filter(x=>x!=='document'))];
  const recordLinks=records.map(record=>{
    const fields=ann.fields.filter(f=>f.record===record),ids=fields.flatMap(f=>layout.observations.filter(o=>inArea(o,f,ann)).map(o=>o.id));
    const touched=layout.pages.flatMap(p=>p.rows).filter(row=>ids.some(id=>row.tokenIds.includes(id)));
    const foreign=ann.fields.filter(f=>f.record!=='document'&&f.record!==record).flatMap(f=>layout.observations.filter(o=>inArea(o,f,ann)).map(o=>o.id));
    return {record,all_in_single_row:touched.some(row=>ids.every(id=>row.tokenIds.includes(id))),mixed_foreign_record:touched.some(row=>foreign.some(id=>row.tokenIds.includes(id)))};
  });
  return {status:layout.structure?'PARTIAL IMPLEMENTATION':'NOT IMPLEMENTED: cell graph; row audit only',pairs_scored:layout.structure?evaluations.length:null,pairs_correct:layout.structure?evaluations.filter(x=>x.correct).length:null,wrong_pairs:layout.structure?evaluations.filter(x=>!x.correct).length:null,pair_evaluations:evaluations,record_links:recordLinks};
}
const isCertain=c=>c.status==='unambiguous'||(!c.status&&['horizontal-local','vertical-local'].includes(c.method));
function bindingScore(layout,ann){
 const byId=new Map(layout.observations.map(o=>[o.id,o]));
 const primary=layout.structure.cells.filter(c=>c.value_source_ids?.length);
 const columns=layout.structure.column_header_candidates??[];
 const eligible=ann.fields.filter(f=>f.essential&&f.label_bbox_pt);
 const matches=c=>eligible.filter(f=>{
  const values=c.value_source_ids.map(id=>byId.get(id)),labels=(c.label_source_ids??[]).map(id=>byId.get(id));
  return values.length&&labels.length&&values.every(o=>inArea(o,f,ann))&&labels.every(o=>inArea(o,f,ann,true))&&norm(values.map(o=>o.raw).join(' '))===norm(f.raw);
 }).map(f=>f.id);
 const scorable=c=>c.value_source_ids.some(id=>eligible.some(f=>inArea(byId.get(id),f,ann)));
 const evaluations=primary.map(c=>({id:c.id,status:isCertain(c)?'unambiguous':c.status??'uncertain',method:c.method,scorable:scorable(c),matches:matches(c),source_ids:c.source_ids}));
 const claimed=new Set();let correct=0;
 for(const e of evaluations.filter(e=>e.status==='unambiguous'&&e.scorable)){
  const unique=e.matches.length===1&&!claimed.has(e.matches[0]);e.correct=unique;if(unique){correct++;claimed.add(e.matches[0]);}
 }
 const possible=new Set([...primary,...columns].flatMap(matches));
 const certain=primary.filter(c=>isCertain(c)&&scorable(c)).length;
 const sourceMap=layout.observations.map(o=>o.id);
 return {unambiguous_correct:correct,unambiguous_denominator:certain,unambiguous_wrong:certain-correct,unscored_unambiguous:primary.filter(c=>isCertain(c)&&!scorable(c)).length,
  uncertain_primary_scorable:primary.filter(c=>!isCertain(c)&&scorable(c)).length,uncertain_primary_matching:primary.filter(c=>!isCertain(c)&&scorable(c)&&matches(c).length===1).length,
  column_scorable:columns.filter(scorable).length,column_matching:columns.filter(c=>scorable(c)&&matches(c).length===1).length,
  certain_binding_recall_numerator:claimed.size,essential_binding_denominator:eligible.length,
  any_state_binding_recall_numerator:possible.size,
  unresolved_essential_binding_ids:eligible.filter(f=>!claimed.has(f.id)).map(f=>f.id),
  primary_proposal_count:layout.structure.cells.length,uncertain_primary_proposals:layout.structure.cells.filter(c=>!isCertain(c)).length,
  column_hypotheses:columns.length,record_proposals:layout.structure.records?.length??null,
  state_counts:Object.fromEntries(['unambiguous','uncertain','unresolved','conflicting'].map(s=>[s,layout.structure.cells.filter(c=>(isCertain(c)?'unambiguous':c.status==='unverified'?'uncertain':c.status??'unresolved')===s).length])),
  evaluations,column_evaluations:columns.map(c=>({id:c.id,status:c.status,scorable:scorable(c),matches:matches(c),source_ids:c.source_ids})),source_references_valid:[...layout.structure.cells,...columns].every(c=>c.source_ids.every(id=>sourceMap.includes(id)))};
}

export {inArea,readerMatch,scoreCore,scoreStructure,bindingScore};
