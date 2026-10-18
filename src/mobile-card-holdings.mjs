/** Narrow, source-bound single-column card adapter. No security lookup or portfolio writes. */
import {parseNumber} from './numbers.mjs';
import {assessSourceBinding} from './structure-learning.mjs';
const norm = s => s.normalize('NFKC').trim().replace(/\s+/g, ' ');
const numeric = s => {const n = parseNumber(s); return n.status === 'valid' && n.value > 0 ? n.value : null;};
function isinValid(s) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s)) return false;
  const digits = [...s].map(c => /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c).join('');
  let sum = 0;
  for (let i = digits.length - 1, double = false; i >= 0; i--, double = !double) {
    let n = Number(digits[i]) * (double ? 2 : 1); sum += n > 9 ? n - 9 : n;
  }
  return sum % 10 === 0;
}
function roleOf(text) {
  // Fold accents ONLY for closed field labels; never for names or identifiers.
  const labels = text.normalize('NFD').replace(/\p{M}/gu, '');
  let m;
  // Explicit source field semantics; not a company/heading vocabulary.
  if ((m=/^(?:Instrument name|Security name|Arvopaperin nimi|Instrumentets namn)\s*:\s*(.+)$/i.exec(text)))
    return /\p{L}/u.test(m[1]) && m[1].length<=100
      ? {role:'text',value:m[1],nameLabel:true} : {role:'unknown'};
  if ((m = /^ISIN\s*:?\s*([A-Z0-9]+)$/i.exec(text)))
    return isinValid(m[1].toUpperCase()) ? {role:'identity', value:{isin:m[1].toUpperCase()}} : {role:'unknown'};
  if ((m = /^(?:Ticker|Symbol)\s*:?\s*([A-Z0-9][A-Z0-9.\/-]{0,14})\s+(?:MIC|Exchange|Pörssi|Börs)\s*:?\s*([A-Z0-9]{4})$/.exec(text)))
    return {role:'identity', value:{ticker:m[1], mic:m[2]}};
  if ((m = /^(?:Quantity|Qty|Maara|Antal)\s*:?\s*([\d., +−-]+)(?:\s+(?:pcs|kpl|st))?$/i.exec(labels)) ||
      (m = /^([\d., +−-]+)\s+(?:pcs|kpl|st)$/i.exec(text)))
    return {role:'measure', value:numeric(m[1])};
  if (/^(?:Quantity|Qty|Määrä|Antal|ISIN|Ticker|Symbol)\b/i.test(text)) return {role:'unknown'};
  if ((m = /^(?:Account|Tili|Konto)\s*:\s*(\S.{0,79})$/i.exec(text))) return {role:'scope', value:m[1]};
  if ((m = /^(?:Currency|Valuutta|Valuta)\s*:?\s*([A-Z]{3})$/.exec(text))) return {role:'currency', value:m[1]};
  if (/^(?:Current price|Quote|Kurssi|Marknadspris)\b/i.test(text)) return {role:'price'};
  if (/^(?:Current value|Value|Arvo|Varde)\b/i.test(labels)) return {role:'total'};
  if (/^(?:Purchase price|Hankintahinta|Inkopspris)\b/i.test(labels)) return {role:'cost'};
  if (/^(?:Day change|Change|Paivan muutos|Tuotto|F(?:o|oe)r(?:a|ae)ndring)\b/i.test(labels)) return {role:'change'};
  if (/^(?:(?:Show sources|Nayta lahteet|More|Enemman|Visa mer|Portfolio|Salkku|Overview|Yhteenveto)|(?:Balance|Saldo|Cash|Kateinen)\s*:?\s*[\d., ]+(?:\s+[A-Z]{3})?)$/i.test(labels)) return {role:'control'};
  if (/\d|[%€$£]/.test(text) || text.length > 100 || !/\p{L}/u.test(text)) return {role:'unknown'};
  return {role:'text', value:text};
}
const field = (value, line) => ({value, status:'candidate', sourceIds:[...line.ids], reviewState:line.corrected?'user-corrected':'untouched'});
export function mobileSourceLines(source, confirmedCorrections=new Map()) {
  if (!source || source.issues?.some(i => i.blocking || i.level === 'blocking') || !Array.isArray(source.observations) || source.observations.length > 2000)
    throw Error('INVALID_SOURCE');
  const seen = new Set();
  const words = source.observations.map(o => {
    const b = o.source?.box;
    const correction=confirmedCorrections.get(o.id);
    if (!o.id || seen.has(o.id) || !b || ![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite) ||
        b.x0 < 0 || b.y0 < 0 || b.x1 > 1 || b.y1 > 1 || b.x1 <= b.x0 || b.y1 <= b.y0 ||
        !Number.isInteger(o.source.page) || o.source.page < 1 || typeof o.raw !== 'string') throw Error('INVALID_GEOMETRY');
    seen.add(o.id);
    return {...b, raw:norm(o.raw), id:o.id, page:o.source.page,
      weak:o.source.format === 'image-ocr' && !correction ? !(o.ocrConfidence >= 85) : false,
      corrected:!!correction, correctionField:correction?.field, sourceNameLabel:correction?.sourceNameLabel, ids:correction?.sourceIds??[o.id],
      identityDisagreement:o.identityDisagreement === true};
  }).filter(o => o.raw);
  words.sort((a,b) => a.page-b.page || a.y0-b.y0 || a.x0-b.x0);
  const lines = [];
  for (const w of words) {
    const line = lines.at(-1);
    if (line && line.page === w.page && Math.abs((line.y0+line.y1)/2-(w.y0+w.y1)/2) < Math.min(line.y1-line.y0,w.y1-w.y0)*0.5) {
      line.words.push(w); line.y0=Math.min(line.y0,w.y0); line.y1=Math.max(line.y1,w.y1);
    } else lines.push({page:w.page,y0:w.y0,y1:w.y1,words:[w]});
  }
  return lines.map(l => {
    l.words.sort((a,b) => a.x0-b.x0);
    const text = norm(l.words.map(w => w.raw).join(' '));
    return {page:l.page, y0:l.y0,y1:l.y1,text,ids:l.words.flatMap(w=>w.ids),corrected:l.words.some(w=>w.corrected),
      nameConfirmed:l.words.length===1&&l.words[0].correctionField==='name',
      weak:l.words.some(w=>w.weak), identityDisagreement:l.words.some(w=>w.identityDisagreement), split:l.words.some((w,i)=>i>0 && w.x0-l.words[i-1].x1 > 0.22), ...(l.words.length===1&&l.words[0].correctionField==='name'?{role:'text',value:text,nameLabel:!!l.words[0].sourceNameLabel}:roleOf(text))};
  });
}
/**
 * Infer which unlabelled text line might be the security name only from
 * INDEPENDENT cards in the CURRENT document. This does not verify securities.
 *
 * A repeating heading alongside a different name in >=3 cards offers bounded
 * context. Learned field positions alone may not supply this evidence.
 * Ambiguous or single-card layouts MUST abstain.
 */
function corroborateNamesAcrossCards(groups) {
  const byPattern=new Map(), candidates=new Map();
  for(let index=0;index<groups.length;index++){
    const lines=groups[index],names=lines.map((line,i)=>line.role==='text'?i:-1).filter(i=>i>=0);
    if(names.length!==2 || lines.length>16 ||
      lines.some(l=>l.split||l.role==='unknown'||(l.role==='text'&&l.weak)) ||
      lines.filter(l=>l.role==='identity').length!==1 ||
      lines.filter(l=>l.role==='measure'&&Number.isFinite(l.value)&&l.value>0).length!==1 ||
      names.some(i=>lines[i].nameLabel||lines[i].nameConfirmed))continue;
    const key=JSON.stringify(lines.map(l=>l.role));
    const batch=byPattern.get(key)??[];
    batch.push({index,lines,names,identity:JSON.stringify(lines.find(l=>l.role==='identity').value)});
    byPattern.set(key,batch);
  }
  for(const batch of byPattern.values()){
    // Requiring three DISTINCT source cards avoids treating two arbitrary
    // text lines as semantically meaningful after only one repetition.
    if(batch.length<3 || new Set(batch.map(b=>b.identity)).size!==batch.length)continue;
    const names=batch[0].names;
    const distinct=names.map(i=>new Set(batch.map(b=>b.lines[i].value)).size);
    const varying=names.filter((i,j)=>distinct[j]===batch.length);
    const shared=names.filter((i,j)=>distinct[j]===1);
    if(varying.length!==1||shared.length!==1)continue;
    // A third card may have weak OCR on its identifier: it can establish a
    // repeated heading pattern, but the resolver still rejects its own row.
    // This provides source-linked B-candidate evidence, not verified identity.
    const nameIndex=varying[0];
    for(const b of batch)candidates.set(b.index,{index:nameIndex,count:batch.length});
  }
  return candidates;
}
export function resolveMobileCards(source, learner, confirmedCorrections=new Map()) {
  let lines;
  try {lines=mobileSourceLines(source,confirmedCorrections);} catch {return {rows:[], unresolved:[{reason:'INVALID_SOURCE'}], cards:[], canPersist:false};}
  if (!lines.length) return {rows:[],unresolved:[{reason:'NO_CARD_EVIDENCE'}],cards:[],canPersist:false};
  const heights=lines.map(l=>l.y1-l.y0).sort((a,b)=>a-b), height=heights[Math.floor(heights.length/2)];
  const groups=[];
  for(const line of lines) {
    const group=groups.at(-1), prev=group?.at(-1);
    if(!prev || prev.page!==line.page || line.y0-prev.y1 > height*1.6) groups.push([line]);
    else group.push(line);
  }
  const rows=[], unresolved=[], cards=[];
  const corroboratedNames=corroborateNamesAcrossCards(groups);
  let account=null, page=null;
  for (let groupIndex=0;groupIndex<groups.length;groupIndex++) {
    const group=groups[groupIndex];
    if(page!==group[0].page){account=null;page=group[0].page;}
    const scopes=group.filter(l=>l.role==='scope');
    if(scopes.length) account=null;
    if (group.every(l=>['scope','control'].includes(l.role))) {
      if (scopes.length===1 && !scopes[0].weak) account=scopes[0];
      else if(scopes.length) {account=null; unresolved.push({reason:'AMBIGUOUS_ACCOUNT'});}
      continue;
    }
    // An unexplained intervening section cannot silently inherit the previous account.
    if(!group.some(l=>l.role==='identity')) account=null;
    const id=`card-${cards.length+1}`;
    const pattern=group.map(l=>l.role);
    const card={id,certainty:'observed',pattern,lines:group,account:scopes.length===1?scopes[0]:account, reason:null};
    cards.push(card);
    const reject=(reason,field=null)=>{card.reason=reason;card.uncertainField=field;unresolved.push({id,reason,...(field?{field,sourceIds:group.filter(l=>l.role==='text').flatMap(l=>l.ids)}:{})});};
    if(group.some(l=>l.identityDisagreement)){reject('OCR_IDENTITY_DISAGREEMENT');continue;}
    if (pattern.length>16 || group.some(l=>l.weak || l.split || l.role==='unknown') || scopes.length>1) {reject('UNCERTAIN_SOURCE_OR_LAYOUT');continue;}
    const identities=group.map((l,i)=>l.role==='identity'?i:-1).filter(i=>i>=0);
    const quantities=group.map((l,i)=>l.role==='measure'?i:-1).filter(i=>i>=0);
    const names=group.map((l,i)=>l.role==='text'?i:-1).filter(i=>i>=0);
    if (identities.length!==1 || quantities.length!==1 || group[quantities[0]].value===null || !names.length) {reject('IDENTITY_OR_QUANTITY_REQUIRED');continue;}
    const profile=learner?.lookup(pattern);
    if (profile?.state==='conflict') {reject('LEARNING_CONFLICT','name');continue;}
    // A role sequence cannot distinguish two arbitrary text lines after a swap.
    // Derive semantics before consulting learned positions. Even a sole free-text
    // line could be a heading above a missing name: cardinality is not semantics.
    const labelled=names.filter(i=>group[i].nameLabel), confirmed=names.filter(i=>group[i].nameConfirmed);
    let entityIndex=null, nameEvidence=null;
    if(labelled.length<=1 && confirmed.length<=1) {
      if(confirmed.length===1 && (!labelled.length || labelled[0]===confirmed[0])) {
        entityIndex=confirmed[0]; nameEvidence='current-document-confirmation';
      } else if(!confirmed.length && labelled.length===1) {
        entityIndex=labelled[0]; nameEvidence='source-label';
      } else if(!confirmed.length&&!labelled.length&&profile?.state==='active'&&corroboratedNames.has(groupIndex)) {
        entityIndex=corroboratedNames.get(groupIndex).index;
        nameEvidence='current-document-cross-card-contrast';
      }
    }
    const binding=entityIndex===null?null:{entity:entityIndex,identity:identities[0],measure:quantities[0]};
    card.teachable=true;
    // A per-document name correction may bypass a stale positional preference,
    // but never mutates/reactivates the profile or overrides a quarantined one.
    const manualName=entityIndex!==null && group[entityIndex].nameConfirmed;
    const assessment=assessSourceBinding(pattern,manualName?null:profile,binding);
    if (!assessment.usable) {reject(assessment.reason,assessment.field);continue;}
    card.binding=binding;
    const entity=group[binding.entity], identity=group[binding.identity], quantity=group[binding.measure];
    // Recheck source semantics even for a learned map. Profiles cannot invent fields.
    if(entity?.role!=='text' || identity?.role!=='identity' || quantity?.role!=='measure' || quantity.value===null) {reject('INVALID_LEARNED_BINDING');continue;}
    const currencies=group.filter(l=>l.role==='currency');
    if(currencies.length>1){reject('AMBIGUOUS_CURRENCY');continue;}
    rows.push({id, fields:{name:field(entity.value,entity),identity:field(identity.value,identity),quantity:field(quantity.value,quantity),
      account:card.account?field(card.account.value,card.account):{value:null,status:'missing',sourceIds:[]},
      currency:currencies.length?field(currencies[0].value,currencies[0]):{value:null,status:'missing',sourceIds:[]},
      buyPrice:{value:null,status:'missing',sourceIds:[]}}, learned:profile?.state==='active'&&!manualName,
      nameEvidence,
      certainty:'candidate',instrumentVerification:{status:'not-verified'},
      warnings:['SOURCE_IDENTITY_NOT_MARKET_VERIFIED','PURCHASE_PRICE_NOT_RESOLVED'], canPersist:false});
  }
  const duplicates=new Map();
  for(const row of rows){const k=JSON.stringify([row.fields.account.value,row.fields.identity.value]); const list=duplicates.get(k)??[];list.push(row.id);duplicates.set(k,list);}
  const repeated=new Set([...duplicates.values()].filter(v=>v.length>1).flat());
  for(const id of repeated) unresolved.push({id,reason:'DUPLICATE_HOLDING'});
  return {rows:rows.filter(r=>!repeated.has(r.id)),unresolved,cards,canPersist:false};
}
/** Ephemeral replay key: deliberately never exported into a learning profile. */
export async function documentKey(source) {
  const raw=JSON.stringify(source.observations.map(o=>norm(o.raw)).sort());
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}

/** Optional local second reading. Disagreement withholds; never substitutes a ticker.
 * Agreement is NOT independent market verification and cannot promote field status.
 */
export function corroborateOcrIdentities(primary, secondary) {
  const out=structuredClone(primary);
  const lines=mobileSourceLines(primary);
  let witness;
  try {witness=mobileSourceLines(secondary);} catch {witness=[];}
  const disputed=new Set();
  for(const line of lines.filter(l=>l.role==='identity')) {
    const matches=witness.filter(w=>w.page===line.page && Math.abs((w.y0+w.y1-line.y0-line.y1)/2)<Math.max(w.y1-w.y0,line.y1-line.y0)*.5);
    if(matches.length!==1 || matches[0].role!=='identity' || matches[0].weak ||
        JSON.stringify(matches[0].value)!==JSON.stringify(line.value)) line.ids.forEach(id=>disputed.add(id));
  }
  out.observations.forEach(o=>{if(disputed.has(o.id))o.identityDisagreement=true;});
  return out;
}
