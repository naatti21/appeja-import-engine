/** Evidence-role contract shared by labelled and compact fund layout adapters.
 * Discovery geometry is not semantic approval. Each monetary token has candidate
 * label edges, card ownership and an explicit reason when the role is unresolved.
 * Uses interval intersection / reading order, never a widened x0 tolerance.
 */
const norm=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0);
const contains=(a,b)=>a.x0<=b.x0&&a.x1>=b.x1&&a.y0<=b.y0&&a.y1>=b.y1&&(a.y1-a.y0)>(b.y1-b.y0);
const money=s=>/^.+?\s+(EUR|USD|SEK|GBP|CHF|NOK|DKK|€)$/i.test(s);
const units=s=>/^.+?\s+(kpl|pcs|st|units|andelar)$/i.test(s);
const ev=s=>({normalizedText:norm(s.raw),sourceIds:s.obs.map(o=>o.id),box:{...s.box},page:s.page,observations:s.obs.map(o=>({sourceId:o.id,raw:o.raw,page:o.source.page,box:{...o.source.box}}))});
export function buildEconomicBindings(lines,cards,roleFor){
 const named=new Set(cards.flatMap(c=>c.nameIds));
 const owner=s=>cards.find(c=>c.page===s.page&&s.box.y0>=c.start&&s.box.y0<c.end)?.id??cards.find(c=>c.page===s.page&&s.box.y0<c.start)?.id??null;
 const numbers=lines.filter(s=>money(s.raw)).map(s=>({segment:s,card:owner(s)}));
 const labels=lines.filter(s=>!money(s.raw)&&!units(s.raw)&&!s.obs.some(o=>named.has(o.id))&&!['name','quantity'].includes(roleFor(s.raw))).map(s=>({segment:s,role:roleFor(s.raw)??'unknownContext',card:owner(s)}));
 // Tesseract may emit a tiny second token entirely inside a recognised label.
 // It is the same pixel region, not an independent field. Retain it as nested
 // evidence; a recognised competing financial role is NEVER discarded here.
 const nested=labels.filter(l=>l.role==='unknownContext'&&labels.some(p=>p!==l&&p.role!=='unknownContext'&&p.segment.page===l.segment.page&&contains(p.segment.box,l.segment.box)));
 const activeLabels=labels.filter(l=>!nested.includes(l));
 const edges=[];
 for(const label of activeLabels){
  const s=label.segment;
  const after=numbers.filter(n=>n.segment.page===s.page&&n.segment.box.y0>s.box.y1&&overlap(s.box,n.segment.box));
  if(!after.length)continue;
  const first=after[0].segment.box;
  const nearest=after.filter(n=>n.segment.box.y0<first.y1);
  for(const number of nearest){
   // A separate later label starts a new vertical field region. Intersecting
   // labels on the same band remain competing claims, not a nearest-x guess.
   if(activeLabels.some(other=>other!==label&&other.segment.page===s.page&&other.segment.box.y0>s.box.y1&&other.segment.box.y1<number.segment.box.y0&&overlap(other.segment.box,number.segment.box)))continue;
   edges.push({role:label.role,label:ev(s),number:ev(number.segment),labelCard:label.card,numberCard:number.card,
    reason:label.card!==number.card?'CROSS_CARD_ROLE_CONFLICT':nearest.length>1?'MULTIPLE_NUMBERS_FOR_LABEL':label.role==='unknownContext'||label.role==='ambiguousFinancialRole'?'UNRESOLVED_LABEL_ROLE':null});
  }
 }
 return {
  forNumber(sourceIds,card,{includeDangling=true}={}){
   const found=numbers.find(n=>n.segment.obs.length===sourceIds.length&&n.segment.obs.every(o=>sourceIds.includes(o.id)));
   if(!found)return {status:'ambiguous',reason:'NUMBER_NOT_IN_BINDING_GRAPH',claims:[]};
   const direct=edges.filter(e=>e.number.sourceIds.some(id=>sourceIds.includes(id)));
   // A dangling price label inside this card is still contradictory evidence,
   // even if there is no safe column edge. Do not turn lack of binding into
   // positive proof that its price is a holdings total.
   const dangling=includeDangling?activeLabels.filter(l=>l.card===card&&l.segment.box.y0<found.segment.box.y0&&['nav','averageAcquisitionPrice','unitPrice','ambiguousFinancialRole'].includes(l.role)&&!edges.some(e=>e.label.sourceIds.some(id=>l.segment.obs.some(o=>o.id===id)))):[];
   const claims=[...direct,...dangling.map(l=>({role:l.role,label:ev(l.segment),number:ev(found.segment),labelCard:l.card,numberCard:found.card,reason:'UNBOUND_PRICE_LABEL_IN_CARD'}))];
   const roles=new Set(claims.map(c=>c.role));
   return {status:claims.some(c=>c.reason)||roles.size>1?'ambiguous':claims.length?'labelled':'unlabelled',reason:claims.find(c=>c.reason)?.reason??(roles.size>1?'COMPETING_ECONOMIC_ROLES':null),claims,nestedEvidence:nested.filter(l=>l.card===card).map(l=>ev(l.segment)),number:ev(found.segment),card};
  }
 };
}
/** Only already-observed proposals are eligible; this function cannot promote. */
export function enforceEconomicBindings(rows,graph){
 for(const row of rows)for(const key of ['value','nav','averageAcquisitionPrice']){
  const field=row.fields[key];if(field.status!=='observed')continue;
  const binding=graph.forNumber(field.sourceIds,row.rowId,{includeDangling:field.bindingMethod==='scoped-unlabelled-total'});field.roleBinding=binding;
  const allowed=field.bindingMethod==='scoped-unlabelled-total'?binding.status==='unlabelled':binding.status==='labelled'&&binding.claims.every(c=>c.role===key&&c.labelCard===row.rowId);
  if(!allowed){field.status='ambiguous';field.reason=binding.reason??'UNPROVEN_ECONOMIC_ROLE';field.decimal=null;}
 }
}
