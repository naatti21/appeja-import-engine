/** Narrow, source-bound single-column card adapter. No security lookup or portfolio writes. */
import {parseNumber} from './numbers.mjs';
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
  let m;
  if ((m = /^ISIN\s*:?\s*([A-Z0-9]+)$/i.exec(text)))
    return isinValid(m[1].toUpperCase()) ? {role:'identity', value:{isin:m[1].toUpperCase()}} : {role:'unknown'};
  if ((m = /^(?:Ticker|Symbol)\s*:?\s*([A-Z0-9][A-Z0-9.\/-]{0,14})\s+(?:MIC|Exchange|Pörssi|Börs)\s*:?\s*([A-Z0-9]{4})$/.exec(text)))
    return {role:'identity', value:{ticker:m[1], mic:m[2]}};
  if ((m = /^(?:Quantity|Qty|Määrä|Antal)\s*:?\s*([\d., +−-]+)(?:\s+(?:pcs|kpl|st))?$/i.exec(text)) ||
      (m = /^([\d., +−-]+)\s+(?:pcs|kpl|st)$/i.exec(text)))
    return {role:'measure', value:numeric(m[1])};
  if (/^(?:Quantity|Qty|Määrä|Antal|ISIN|Ticker|Symbol)\b/i.test(text)) return {role:'unknown'};
  if ((m = /^(?:Account|Tili|Konto)\s*:\s*(\S.{0,79})$/i.exec(text))) return {role:'scope', value:m[1]};
  if ((m = /^(?:Currency|Valuutta|Valuta)\s*:?\s*([A-Z]{3})$/.exec(text))) return {role:'currency', value:m[1]};
  if (/^(?:Current price|Quote|Kurssi|Marknadspris)\b/i.test(text)) return {role:'price'};
  if (/^(?:Current value|Value|Arvo|Värde)\b/i.test(text)) return {role:'total'};
  if (/^(?:Purchase price|Hankintahinta|Inköpspris)\b/i.test(text)) return {role:'cost'};
  if (/^(?:Day change|Change|Päivän muutos|Tuotto|Förändring)\b/i.test(text)) return {role:'change'};
  if (/^(?:(?:Show sources|Näytä lähteet|More|Enemmän|Visa mer|Portfolio|Salkku|Overview|Yhteenveto)|(?:Balance|Saldo|Cash|Käteinen)\s*:?\s*[\d., ]+(?:\s+[A-Z]{3})?)$/i.test(text)) return {role:'control'};
  if (/\d|[%€$£]/.test(text) || text.length > 100 || !/\p{L}/u.test(text)) return {role:'unknown'};
  return {role:'text', value:text};
}
const field = (value, line) => ({value, status:'candidate', sourceIds:[...line.ids]});
function linesFrom(source) {
  if (!source || source.issues?.some(i => i.blocking || i.level === 'blocking') || !Array.isArray(source.observations) || source.observations.length > 2000)
    throw Error('INVALID_SOURCE');
  const seen = new Set();
  const words = source.observations.map(o => {
    const b = o.source?.box;
    if (!o.id || seen.has(o.id) || !b || ![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite) ||
        b.x0 < 0 || b.y0 < 0 || b.x1 > 1 || b.y1 > 1 || b.x1 <= b.x0 || b.y1 <= b.y0 ||
        !Number.isInteger(o.source.page) || o.source.page < 1 || typeof o.raw !== 'string') throw Error('INVALID_GEOMETRY');
    seen.add(o.id);
    return {...b, raw:norm(o.raw), id:o.id, page:o.source.page,
      weak:o.source.format === 'image-ocr' ? !(o.ocrConfidence >= 85) : false,
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
    return {page:l.page, y0:l.y0,y1:l.y1,text,ids:l.words.map(w=>w.id),
      weak:l.words.some(w=>w.weak), identityDisagreement:l.words.some(w=>w.identityDisagreement), split:l.words.some((w,i)=>i>0 && w.x0-l.words[i-1].x1 > 0.22), ...roleOf(text)};
  });
}
export function resolveMobileCards(source, learner) {
  let lines;
  try {lines=linesFrom(source);} catch {return {rows:[], unresolved:[{reason:'INVALID_SOURCE'}], cards:[], canPersist:false};}
  if (!lines.length) return {rows:[],unresolved:[{reason:'NO_CARD_EVIDENCE'}],cards:[],canPersist:false};
  const heights=lines.map(l=>l.y1-l.y0).sort((a,b)=>a-b), height=heights[Math.floor(heights.length/2)];
  const groups=[];
  for(const line of lines) {
    const group=groups.at(-1), prev=group?.at(-1);
    if(!prev || prev.page!==line.page || line.y0-prev.y1 > height*1.6) groups.push([line]);
    else group.push(line);
  }
  const rows=[], unresolved=[], cards=[];
  let account=null, page=null;
  for (const group of groups) {
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
    const card={id,pattern,lines:group,account:scopes.length===1?scopes[0]:account, reason:null};
    cards.push(card);
    const reject=reason=>{card.reason=reason;unresolved.push({id,reason});};
    if(group.some(l=>l.identityDisagreement)){reject('OCR_IDENTITY_DISAGREEMENT');continue;}
    if (pattern.length>16 || group.some(l=>l.weak || l.split || l.role==='unknown') || scopes.length>1) {reject('UNCERTAIN_SOURCE_OR_LAYOUT');continue;}
    const identities=group.map((l,i)=>l.role==='identity'?i:-1).filter(i=>i>=0);
    const quantities=group.map((l,i)=>l.role==='measure'?i:-1).filter(i=>i>=0);
    const names=group.map((l,i)=>l.role==='text'?i:-1).filter(i=>i>=0);
    if (identities.length!==1 || quantities.length!==1 || group[quantities[0]].value===null || !names.length) {reject('IDENTITY_OR_QUANTITY_REQUIRED');continue;}
    const profile=learner?.lookup(pattern);
    if (profile?.state==='conflict') {reject('LEARNING_CONFLICT');continue;}
    let binding=names.length===1?{entity:names[0],identity:identities[0],measure:quantities[0]}:null;
    if(profile?.state==='active') binding=profile.binding;
    card.teachable=true;
    if (!binding) {reject(profile?'PROVISIONAL_STRUCTURE':'AMBIGUOUS_NAME');continue;}
    card.binding=binding;
    const entity=group[binding.entity], identity=group[binding.identity], quantity=group[binding.measure];
    // Recheck source semantics even for a learned map. Profiles cannot invent fields.
    if(entity?.role!=='text' || identity?.role!=='identity' || quantity?.role!=='measure' || quantity.value===null) {reject('INVALID_LEARNED_BINDING');continue;}
    const currencies=group.filter(l=>l.role==='currency');
    if(currencies.length>1){reject('AMBIGUOUS_CURRENCY');continue;}
    rows.push({id, fields:{name:field(entity.value,entity),identity:field(identity.value,identity),quantity:field(quantity.value,quantity),
      account:card.account?field(card.account.value,card.account):{value:null,status:'missing',sourceIds:[]},
      currency:currencies.length?field(currencies[0].value,currencies[0]):{value:null,status:'missing',sourceIds:[]},
      buyPrice:{value:null,status:'missing',sourceIds:[]}}, learned:profile?.state==='active',
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
  const lines=linesFrom(primary);
  let witness;
  try {witness=linesFrom(secondary);} catch {witness=[];}
  const disputed=new Set();
  for(const line of lines.filter(l=>l.role==='identity')) {
    const matches=witness.filter(w=>w.page===line.page && Math.abs((w.y0+w.y1-line.y0-line.y1)/2)<Math.max(w.y1-w.y0,line.y1-line.y0)*.5);
    if(matches.length!==1 || matches[0].role!=='identity' || matches[0].weak ||
        JSON.stringify(matches[0].value)!==JSON.stringify(line.value)) line.ids.forEach(id=>disputed.add(id));
  }
  out.observations.forEach(o=>{if(disputed.has(o.id))o.identityDisagreement=true;});
  return out;
}
