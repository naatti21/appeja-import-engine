/** Conservative PDF source triage; relevance is NOT value/header/context evidence. */
const validBox=b=>b&&['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))&&b.x0>=0&&b.y0>=0&&b.x1<=1&&b.y1<=1&&b.x1>b.x0&&b.y1>b.y0;
const overlap=(a,b)=>a.page===b.page&&validBox(a.box)&&validBox(b.box)&&Math.min(a.box.x1,b.box.x1)>Math.max(a.box.x0,b.box.x0)&&Math.min(a.box.y1,b.box.y1)>Math.max(a.box.y0,b.box.y0);
function administrative(o,pageCount){
 // No token deletion, normalization of digits, substring matches or cross-source joins.
 const s=o.raw.trim();if(/[\r\n]/.test(s))return null;
 let m=s.match(/^(?:Page (\d{1,4}) of (\d{1,4})|Sivu (\d{1,4}) \/ (\d{1,4}))$/i);
 if(m){const p=Number(m[1]??m[3]),n=Number(m[2]??m[4]);return p===o.page&&n===pageCount&&p>=1&&p<=n?{rule:'page-counter',key:'page:'+o.page,value:p+'/'+n}:null;}
 m=s.match(/^(Generated on|Printed on): (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/i);
 if(m){const d=new Date(m[2]);if(!Number.isNaN(d.valueOf())&&d.toISOString().replace('.000Z','Z')===m[2])return {rule:'administrative-timestamp',key:m[1].toLowerCase(),value:m[2]};return null;}
 m=s.match(/^(?:Document ID|Asiakirjatunnus): ([A-Z]{2,8}-[A-Z0-9]{2,24})$/);
 if(m)return {rule:'document-reference',key:'document-reference',value:m[1]};
 if(/^(?:Confidential|Luottamuksellinen|Copy for recipient|Kopio vastaanottajalle)$/i.test(s))return {rule:'administrative-notice'};
 m=s.match(/^Document language: (English|Finnish|Swedish)$/);
 if(m)return {rule:'document-language',key:'document-language',value:m[1]};
 return null;
}
function financiallyRelevant(raw){return /\d|[%€$£¥]|\b(?:EUR|USD|SEK|GBP|JPY|pay|salary|gross|net|quantity|price|balance|tax|currency|account|palkka|brutto|netto|määrä|kurssi|arvo|valuutta|tili)\b/i.test(raw);}
export function classifySources(layout){
 const observations=structuredClone(Array.isArray(layout?.observations)?layout.observations:[]);
 const unplaced=structuredClone(Array.isArray(layout?.unplacedObservations)?layout.unplacedObservations:[]);
 const issues=structuredClone(Array.isArray(layout?.issues)?layout.issues:[]);
 const pages=layout?.pages;
 let invalid=!Array.isArray(layout?.observations)||!Array.isArray(layout?.issues)||!Array.isArray(layout?.unplacedObservations)||!Array.isArray(pages)||!observations.length;
 const all=[...observations,...unplaced],counts=new Map();
 for(const o of all)counts.set(o?.id,(counts.get(o?.id)??0)+1);
 const entries=all.map((o,index)=>{
  const placed=index<observations.length;
  const valid=placed&&o&&typeof o.id==='string'&&o.id.trim()&&counts.get(o.id)===1&&typeof o.raw==='string'&&o.raw.trim()&&Number.isInteger(o.page)&&o.page>=1&&o.page<=pages?.length&&validBox(o.box);
  const admin=valid&&layout.sourceKind==='pdf-text'?administrative(o,pages.length):null;
  return {sourceId:o?.id??null,sourceIndex:index,raw:o?.raw??null,category:admin?'administrative':financiallyRelevant(String(o?.raw??''))?'financial':'uncertain',requiresCorrection:!admin,reason:admin?.rule??'unresolved-source',administrativeEvidence:admin,valid:!!valid};
 });
 // Geometry collisions apply to ALL observations, not just fields already claimed.
 const colliding=new Set();
 for(let i=0;i<observations.length;i++)for(let j=i+1;j<observations.length;j++)if(overlap(observations[i]??{},observations[j]??{})){colliding.add(i);colliding.add(j);}
 const declarations=new Map();
 for(const e of entries){const a=e.administrativeEvidence;if(a?.key){if(!declarations.has(a.key))declarations.set(a.key,new Set());declarations.get(a.key).add(a.value);}}
 for(const e of entries){
  const conflicting=e.administrativeEvidence?.key&&declarations.get(e.administrativeEvidence.key).size>1;
  if(!e.valid||colliding.has(e.sourceIndex)||conflicting||issues.length||invalid){
   e.category='uncertain';e.requiresCorrection=true;e.reason=!e.valid?'invalid-or-unplaced-source':colliding.has(e.sourceIndex)?'overlapping-source':conflicting?'conflicting-metadata':'reader-incomplete';
  }
  delete e.valid;
 }
 if(invalid)issues.push({code:'INCOMPLETE_SOURCE_ENVELOPE'});
 const correctionRequired=!!(invalid||issues.length||unplaced.length||entries.some(e=>e.requiresCorrection));
 return {observations,unplacedObservations:unplaced,entries,issues,correctionRequired,
  status:correctionRequired?'correction-required':'informational-only',
  canAutoAccept:false,canPersist:false,
  summary:{original:all.length,administrative:entries.filter(e=>e.category==='administrative').length,actionable:entries.filter(e=>e.requiresCorrection).length}};
}
