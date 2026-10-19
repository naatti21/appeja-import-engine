/**
 * Source-linked visual investment-list extractor (research adapter).
 *
 * Accepts canonical geometry from evidenceFromOcrTsv. It does not require
 * ticker/ISIN and never verifies market identity, writes holdings or learns
 * names. All values remain only in the caller's in-memory result.
 */
import {uniqueMoney,uniqueQuantity,financialQuantityMatches} from './portfolio-financial-evidence.mjs';

const TYPES={osakkeet:'stock',aktier:'stock',stocks:'stock',shares:'stock',
  rahastot:'fund',fonder:'fund',funds:'fund'};
const STOPS=/^(?:säästötilit|saastotilit|savings accounts|sparkonton|accounts|tilit)$/i;
const CASH=/^(?:käytettävissä oleva saldo|kaytettavissa oleva saldo|available balance|disponibelt saldo)$/i;
const TOTAL=/^(?:arvo yhteensä|arvo yhteensa|total value|värde totalt|varde totalt)(?=\s|$)/i;
const EXCLUDE=/^(?:sijoitukset|sijoita|säästä ja sijoita|saasta ja sijoita|portfolio|overview|muutos|kurssi|omistus|arvonmuutos|arvonmuutos 1 päivä|arvonmuutos 1 paiva|päivän muutos|paivan muutos|suodata tuloksia|filter results|arvo yhteensä|arvo yhteensa|käytettävissä oleva saldo|kaytettavissa oleva saldo|available balance|total value|säästötilit|saastotilit|katsaus|maksa|palvelumme|tuki|more)$/i;
const asCurrency=s=>({'€':'EUR','$':'USD','£':'GBP'})[s]??s.toUpperCase();
const strip=s=>s.normalize('NFKC').replace(/\s+/gu,' ').trim();
function parseMoney(text) {
  return uniqueMoney(text)?.value??null;
}
function rightSourceIdsForMatch(line,match) {
  if(!match)return [];
  let at=0;
  const ids=[];
  for(const word of line.words.filter(w=>line.rightIds.includes(w.id))) {
    const end=at+word.raw.length;
    if(end>match.index && at<match.index+match[0].length)ids.push(word.id);
    at=end+1;
  }
  return [...new Set(ids)];
}
function uniqueRightMoney(line) {
  const candidate=uniqueMoney(line.right);
  if(!candidate)return null;
  const ids=rightSourceIdsForMatch(line,candidate.match);
  return ids.length?{value:candidate.value,ids}:null;
}
function parseQty(text) {
  return uniqueQuantity(text)?.value??null;
}
function validatedWords(source) {
  if(!source||!Array.isArray(source.observations)||source.observations.length>3000||
    source.issues?.some(x=>x.blocking||x.level==='blocking'))throw Error('INVALID_SOURCE');
  const ids=new Set();
  return source.observations.map(o=>{
    const b=o.source?.box;
    if(!o.id||ids.has(o.id)||typeof o.raw!=='string'||!b||
      ![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite)||
      b.x0<0||b.y0<0||b.x1>1||b.y1>1||b.x0>=b.x1||b.y0>=b.y1||
      !Number.isInteger(o.source?.page)||o.source.page<1)throw Error('INVALID_GEOMETRY');
    ids.add(o.id);
    return {id:o.id,raw:strip(o.raw),box:b,page:o.source.page,
      weak:o.source.format==='image-ocr'&&!(o.ocrConfidence>=75)};
  }).filter(w=>w.raw).sort((a,b)=>a.page-b.page||((a.box.y0+a.box.y1)-(b.box.y0+b.box.y1))||a.box.x0-b.box.x0);
}
function makeLines(words) {
  const lines=[];
  for(const w of words){
    const cy=(w.box.y0+w.box.y1)/2,h=w.box.y1-w.box.y0;
    const last=lines.at(-1);
    if(last&&last.page===w.page&&Math.abs(last.cy-cy)<=Math.max(.004,Math.min(last.h,h)*.48)){
      last.words.push(w);last.cy=(last.cy+cy)/2;last.h=Math.max(last.h,h);
    }else lines.push({page:w.page,cy,h,words:[w]});
  }
  for(const l of lines){
    l.words.sort((a,b)=>a.box.x0-b.box.x0);
    l.text=strip(l.words.map(w=>w.raw).join(' '));
    l.ids=l.words.map(w=>w.id);
    l.weak=l.words.some(w=>w.weak);
    l.left=strip(l.words.filter(w=>w.box.x0<.60).map(w=>w.raw).join(' '));
    l.right=strip(l.words.filter(w=>w.box.x0>=.60).map(w=>w.raw).join(' '));
    l.rightIds=l.words.filter(w=>w.box.x0>=.60).map(w=>w.id);
    l.leftIds=l.words.filter(w=>w.box.x0<.60).map(w=>w.id);
  }
  return lines;
}
/**
 * Find the left/right gutter from CURRENT source geometry, rather than
 * assuming 60% of every phone screenshot. Text on the right must still be
 * parsed into a valid quantity or money amount before it becomes a field.
 * Only instrument sections contribute anchors, not balances or UI headers.
 * If no usable anchors exist, use the conservative legacy 60% divider.
 */
function assignVisualColumns(lines) {
  let active=false;
  const anchors=[];
  for(const line of lines) {
    const t=line.text.toLowerCase();
    if(Object.hasOwn(TYPES,t)){active=true;continue;}
    if(STOPS.test(t)){active=false;continue;}
    if(!active)continue;
    if(parseQty(line.text)!==null) {
      const found=line.words.find(w=>w.box.x0>=.38 && /\d/u.test(w.raw));
      if(found)anchors.push(found.box.x0);
      continue;
    }
    // A market-value amount is a right-side price, not a day-change
    // percentage, signed gain/loss or summary heading.
    if(/[%]/u.test(line.text)||/^[+−-]/u.test(line.text) ||
        EXCLUDE.test(line.text))continue;
    if(parseMoney(line.text)) {
      const found=line.words.find(w=>w.box.x0>=.38 &&
        /[.,]\d{2}/u.test(w.raw));
      if(found)anchors.push(found.box.x0);
    }
  }
  const divider=anchors.length
    ?Math.min(.60,Math.max(.35,Math.min(...anchors)-.035)):.60;
  for(const line of lines) {
    const left=line.words.filter(w=>w.box.x0<divider);
    const right=line.words.filter(w=>w.box.x0>=divider);
    line.left=strip(left.map(w=>w.raw).join(' '));
    line.right=strip(right.map(w=>w.raw).join(' '));
    line.leftIds=left.map(w=>w.id);
    line.rightIds=right.map(w=>w.id);
  }
  return divider;
}
function sourceField(value,ids) {
  return {value,status:'candidate',sourceIds:[...new Set(ids)]};
}
function findLedgerSummary(lines) {
  // Financial scope is defined by an explicitly observed portfolio heading,
  // never by the proximity of unrelated amounts. Cropped images simply
  // cannot be arithmetically reconciled.
  const totals=[],cashes=[];
  let scopeOpen=false,scopeClosed=false,sectionCount=0;
  for(let i=0;i<lines.length;i++) {
    const l=lines[i],t=l.text;
    if(/^(?:sijoitukset|investments|investeringar)$/iu.test(t)) {
      sectionCount++;scopeOpen=true;
      continue;
    }
    if(STOPS.test(t) && scopeOpen){scopeClosed=true;scopeOpen=false;continue;}
    if(!scopeOpen||scopeClosed)continue;
    const kind=TOTAL.test(t)?'total':CASH.test(t)?'cash':null;
    if(!kind)continue;
    let priced=null, observed=null;
    const own=uniqueMoney(l.text);
    if(own&&!l.weak) {
      priced=own.value;observed=l;
    } else {
      const next=lines[i+1];
      const pure=next&&uniqueMoney(next.text);
      if(next&&next.page===l.page&&next.cy>l.cy&&next.cy-l.cy<.05&&
        pure&&!next.weak&&strip(next.text)===strip(pure.match[0])) {
        priced=pure.value;observed=next;
      }
    }
    if(!priced)continue;
    const value={...priced,sourceIds:[...new Set([...l.ids,...observed.ids])]};
    if(kind==='total')totals.push(value);else cashes.push(value);
  }
  return {
    total:totals.length===1?totals[0]:null,
    cash:cashes.length===1?cashes[0]:null,
    ambiguous:sectionCount>1||totals.length>1||cashes.length>1
  };
}
function reconcile(candidates,summary,unresolved) {
  const result={status:'not-evaluable',reason:'MISSING_INDEPENDENT_TOTAL_OR_CASH',canPersist:false};
  if(summary.ambiguous)return {...result,reason:'AMBIGUOUS_SUMMARY'};
  if(!summary.total||!summary.cash)return result;
  if(summary.total.currency!==summary.cash.currency)return {...result,reason:'MIXED_CURRENCIES'};
  if(!candidates.length||unresolved.length||candidates.some(c=>!c.fields.marketValue.value))
    return {...result,reason:'INCOMPLETE_SOURCE_ROWS'};
  if(candidates.some(c=>c.fields.marketValue.value.currency!==summary.total.currency))
    return {...result,reason:'MIXED_CURRENCIES'};
  const items=candidates.reduce((sum,c)=>sum+c.fields.marketValue.value.cents,0);
  if(!Number.isSafeInteger(items))return {...result,reason:'NUMERIC_OVERFLOW'};
  const computed=items+summary.cash.cents;
  if(!Number.isSafeInteger(computed))return {...result,reason:'NUMERIC_OVERFLOW'};
  const difference=computed-summary.total.cents;
  return {status:difference===0?'pass':'mismatch',reason:difference===0?
    'VISIBLE_VALUES_MATCH':'VISIBLE_VALUES_DIFFER',currency:summary.total.currency,
    visibleHoldingsCents:items,cashCents:summary.cash.cents,
    reportedTotalCents:summary.total.cents,differenceCents:difference,
    sourceIds:[...new Set([...candidates.flatMap(c=>c.fields.marketValue.sourceIds),
      ...summary.cash.sourceIds,...summary.total.sourceIds])],
    marketIdentityVerified:false,completenessProven:false,canPersist:false};
}
/**
 * Evidence grade is always B candidate. Real market verification (C) belongs
 * to a separate privacy-reviewed resolver and explicit user approval.
 */
export function extractVisualPortfolio(source,{crossReadOnly=false}={}) {
  let lines;
  try{lines=makeLines(validatedWords(source));}
  catch{return {candidates:[],unresolved:[{reason:'INVALID_SOURCE'}],
    reconciliation:{status:'not-evaluable',reason:'INVALID_SOURCE'},canPersist:false};}
  assignVisualColumns(lines);
  const summary=findLedgerSummary(lines),candidates=[],unresolved=[];
  const boundaries=[];
  for(let i=0;i<lines.length;i++){
    const t=strip(lines[i].text).toLowerCase();
    if(Object.hasOwn(TYPES,t))boundaries.push({i,type:TYPES[t]});
    else if(STOPS.test(t))boundaries.push({i,type:null});
  }
  let active=null,boundaryIndex=-1,lastQtyCy=-Infinity,lastPage=null;
  for(let i=0;i<lines.length;i++){
    const l=lines[i],b=boundaries.find(x=>x.i===i);
    if(l.page!==lastPage){active=null;lastQtyCy=-Infinity;lastPage=l.page;}
    if(b){active=b.type;boundaryIndex=i;lastQtyCy=-Infinity;continue;}
    if(!active)continue;
    // Right-hand "n kpl" is a strong visual holdings row anchor. A floating
    // amount without quantity must never become a holding.
    const right=l.words.filter(w=>l.rightIds.includes(w.id));
    const qtext=strip(right.map(w=>w.raw).join(' '));
    const quantityMatches=financialQuantityMatches(qtext);
    if(quantityMatches.length>1) {
      unresolved.push({reason:'AMBIGUOUS_QUANTITY',field:'quantity',sourceIds:l.rightIds,canPersist:false});
      lastQtyCy=l.cy;continue;
    }
    const quantity=parseQty(qtext);
    if(quantity===null)continue;
    // Even a withheld quantity consumes its visual row boundary.
    const previousQtyCy=lastQtyCy;
    lastQtyCy=l.cy;
    const quantityIds=rightSourceIdsForMatch(l,quantityMatches[0]?.match);
    if(!quantityIds.length)continue;
    const quantityWords=right.filter(w=>/\d/.test(w.raw));
    if(!quantityWords.length||(!crossReadOnly&&right.some(w=>quantityIds.includes(w.id)&&w.weak))){
      unresolved.push({reason:'UNCERTAIN_QUANTITY',sourceIds:l.rightIds});continue;
    }
    // Per-row right hand value is above or aligned with the quantity.
    const valueLines=lines.filter(p=>p.page===l.page&&p.cy>=l.cy-.055&&p.cy<=l.cy+.012 &&
      p.cy>previousQtyCy+.006&&p.right&&p.rightIds.length&&
      uniqueRightMoney(p)&&(crossReadOnly||p.words.filter(w=>uniqueRightMoney(p).ids.includes(w.id)).every(w=>!w.weak)));
    const amountLine=valueLines.filter(p=>(p===l||!financialQuantityMatches(p.right).length)&&
      !EXCLUDE.test(p.left)&&!/\b(?:arvonmuutos|päivän muutos|paivan muutos|day change)\b/iu.test(p.left))
      .sort((a,b)=>Math.abs(l.cy-a.cy)-Math.abs(l.cy-b.cy))[0];
    // If amount is unavailable, a source-linked name+quantity is still a
    // reviewable candidate, but cannot be used for arithmetic.
    const start=amountLine?amountLine.cy-.014:l.cy-.035;
    const eligible=lines.filter(p=>p.page===l.page&&p.cy>=Math.max(start,previousQtyCy+.006)&&
      p.cy<=l.cy+.018&&p.left&&p.leftIds.length&&
      !EXCLUDE.test(p.left)&&!Object.hasOwn(TYPES,p.left.toLowerCase())&&
      !STOPS.test(p.left)&&!parseMoney(p.left)&&!financialQuantityMatches(p.left).length&&
      (crossReadOnly||p.words.filter(w=>p.leftIds.includes(w.id)).every(w=>!w.weak)));
    // Inspect the COMPLETE source interval, not only the short window near
    // the amount. Low-confidence competing text remains conflict evidence.
    // OCR agreement and arithmetic cannot establish a text's semantic role.
    const context=lines.slice(boundaryIndex+1,i+1).filter(p=>
      p.page===l.page&&p.cy>previousQtyCy+.006&&p.left&&p.leftIds.length&&
      !EXCLUDE.test(p.left)&&!Object.hasOwn(TYPES,p.left.toLowerCase())&&
      !STOPS.test(p.left)&&!parseMoney(p.left)&&!financialQuantityMatches(p.left).length);
    // Supported row grammar: one complete name at the value/quantity anchor,
    // optionally a single-letter fund share-class continuation at quantity.
    // Arbitrary multi-line text cannot safely be concatenated into a name.
    const parts=eligible;
    const continuation=active==='fund'&&parts.length===2&&
      parts[0]===amountLine&&parts[1]===l&&/^[A-Z]$/u.test(parts[1].left);
    const competing=context.some(p=>!parts.includes(p))||
      (parts.length>1&&!continuation);
    const aligned=parts.length===1&&(parts[0]===amountLine||parts[0]===l||
      (!amountLine&&parts[0].cy<l.cy&&context.length===1));
    const name=strip(parts.map(p=>p.left).join(' '));
    if(competing||(!aligned&&!continuation)||!name||name.length>140||!/\p{L}/u.test(name)){
      unresolved.push({reason:'UNRESOLVED_INSTRUMENT_NAME',field:'name',
        detail:competing?'COMPETING_SOURCE_TEXT':'UNPROVEN_ROW_BINDING',
        sourceIds:[...new Set([...context.flatMap(p=>p.ids),...l.ids])],
        requiresUserApproval:true,canPersist:false});continue;
    }
    const ids=[...new Set(parts.flatMap(p=>p.leftIds))];
    const amountEvidence=amountLine?uniqueRightMoney(amountLine):null;
    candidates.push({kind:active,certainty:'candidate',marketVerification:{status:'not-verified'},
      fields:{name:sourceField(name,ids),quantity:sourceField(quantity,quantityIds),
        marketValue:amountEvidence?sourceField(amountEvidence.value,amountEvidence.ids):{value:null,status:'missing',sourceIds:[]},
        purchasePrice:{value:null,status:'missing',sourceIds:[]}},
      canPersist:false});
  }
  // A source observation can support only one holding. Withhold ALL owners
  // of a collision rather than choosing whichever row happened to run first.
  const owners=new Map();
  for(const c of candidates)for(const id of new Set(Object.values(c.fields).flatMap(f=>f.sourceIds))) {
    const rows=owners.get(id)??[];rows.push(c);owners.set(id,rows);
  }
  const conflicted=new Set([...owners.values()].filter(rows=>rows.length>1).flat());
  for(let i=candidates.length-1;i>=0;i--)if(conflicted.has(candidates[i])) {
    const c=candidates.splice(i,1)[0];
    unresolved.push({reason:'SHARED_ROW_SOURCE',field:'name',
      sourceIds:[...new Set(Object.values(c.fields).flatMap(f=>f.sourceIds))],canPersist:false});
  }
  // An unused source-visible valuation is a potential missed position.
  // Arithmetic equality cannot prove completeness if such a value exists.
  // Rejected rows have already accounted for their own source money evidence;
  // do not produce a second orphan for the same underlying name conflict.
  const used=new Set([...candidates.flatMap(c=>c.fields.marketValue.sourceIds),
    ...unresolved.flatMap(u=>u.sourceIds??[])]);
  let inList=false;
  for(const l of lines) {
    const text=strip(l.text).toLowerCase();
    if(Object.hasOwn(TYPES,text)){inList=true;continue;}
    if(STOPS.test(text)){inList=false;continue;}
    if(!inList||EXCLUDE.test(l.left)||/arvonmuutos|päivän muutos|paivan muutos|day change|%/iu.test(l.text))continue;
    const money=uniqueRightMoney(l);
    if(money && money.ids.some(id=>!used.has(id)))
      unresolved.push({reason:'UNPAIRED_MARKET_VALUE',sourceIds:money.ids});
  }
  return {candidates,unresolved,summary,reconciliation:reconcile(candidates,summary,unresolved),
    requiresUserApproval:true,canPersist:false};
}


/**
 * Conservative opt-in local second OCR reading. Independently parsable name,
 * quantity and valuation on the same visual row must agree. A disagreement
 * WITHHOLDS the instrument; it does not guess a Q/O fix or learn a dictionary.
 * Agreement between Tesseract language models is not market identity proof.
 */
export function extractVisualPortfolioCorroborated(primarySource, witnessSource) {
  // Tentative low-confidence fields stay INTERNAL to this two-read gate.
  // Never publish either pass independently when evidence is weak.
  const primary=extractVisualPortfolio(primarySource,{crossReadOnly:true});
  const witness=extractVisualPortfolio(witnessSource,{crossReadOnly:true});
  if(primary.unresolved.some(u=>u.reason==='INVALID_SOURCE')||
     witness.unresolved.some(u=>u.reason==='INVALID_SOURCE'))
    return {candidates:[],unresolved:[{reason:'INVALID_SOURCE'}],
      reconciliation:{status:'not-evaluable',reason:'INVALID_SOURCE'},
      requiresUserApproval:true,canPersist:false};
  function rowY(source,row) {
    const ids=new Set(row.fields.quantity.sourceIds);
    const words=source.observations.filter(o=>ids.has(o.id));
    return words.length?words.reduce((sum,o)=>sum+(o.source.box.y0+o.source.box.y1)/2,0)/words.length:null;
  }
  function tokenSupportedAcrossReads(a,b) {
    const idsA=a?.sourceIds??[],idsB=b?.sourceIds??[];
    const byIdA=new Map(primarySource.observations.map(o=>[o.id,o]));
    const byIdB=new Map(witnessSource.observations.map(o=>[o.id,o]));
    if(!idsA.length||idsA.length!==idsB.length)return false;
    for(let i=0;i<idsA.length;i++) {
      const x=byIdA.get(idsA[i]),y=byIdB.get(idsB[i]);
      if(!x||!y||strip(x.raw)!==strip(y.raw)||
         x.source.page!==y.source.page)return false;
      const xb=x.source.box,yb=y.source.box;
      const cx=(xb.x0+xb.x1)/2,cy=(xb.y0+xb.y1)/2;
      if(Math.abs(cx-(yb.x0+yb.x1)/2)>.05||
         Math.abs(cy-(yb.y0+yb.y1)/2)>.03)return false;
      const strongX=x.source.format!=='image-ocr'||x.ocrConfidence>=75;
      const strongY=y.source.format!=='image-ocr'||y.ocrConfidence>=75;
      if(!strongX&&!strongY)return false;
    }
    return true;
  }
  function fieldAgreement(p,w) {
    for(const key of ['name','quantity','marketValue']) {
      const a=p.fields[key],b=w.fields[key];
      if(!a||!b)return false;
      const valueA=key==='marketValue'?JSON.stringify(a.value):a.value;
      const valueB=key==='marketValue'?JSON.stringify(b.value):b.value;
      if(valueA!==valueB)return false;
      // Each source word needs matching text, near-identical source geometry,
      // and at least ONE high-confidence reading. Complementary model
      // strengths may corroborate a field; two weak tokens never do.
      if(a.value!==null && !tokenSupportedAcrossReads(a,b))return false;
    }
    return true;
  }
  const candidates=[],unresolved=[...primary.unresolved];
  for(const item of primary.candidates) {
    const py=rowY(primarySource,item),amount=item.fields.marketValue.value;
    const matches=witness.candidates.filter(other=>
      other.kind===item.kind&&other.fields.quantity.value===item.fields.quantity.value&&
      Math.abs(rowY(witnessSource,other)-py)<.04&&
      ((amount===null&&other.fields.marketValue.value===null)||
       (amount!==null&&other.fields.marketValue.value?.cents===amount.cents&&
        other.fields.marketValue.value?.currency===amount.currency)));
    if(matches.length!==1||!fieldAgreement(item,matches[0])||
       strip(matches[0].fields.name.value)!==strip(item.fields.name.value)) {
      unresolved.push({reason:'OCR_NAME_DISAGREEMENT',sourceIds:item.fields.name.sourceIds});
      continue;
    }
    candidates.push({...item,ocrNameAgreement:'two-local-language-reads',
      confidenceBasis:'exact-source-tokens-two-local-reads-at-least-one-strong-per-token'});
  }
  return {...primary,candidates,unresolved,
    reconciliation:reconcile(candidates,primary.summary,unresolved),canPersist:false};
}
