/**
 * Strict, source-token-level financial evidence for portfolio research.
 * Every currency/quantity suffix remains accounted for, even if its
 * adjacent number is malformed, ambiguous, signed or OCR-truncated.
 * No automatic writes, market identity verification or network.
 */
import {parseNumber} from './numbers.mjs';
const normalize=s=>String(s??'').normalize('NFKC')
  .replace(/[\u00a0\u202f]/gu,' ').replace(/\s+/gu,' ').trim();
const QUANTITY=/(?<![\p{L}\p{N}.,])([+\-−(]?\s*\d(?:[\d., ]*\d)?)\s*(kpl|pcs|st)\b/giu;
const MONEY=/(?<![\p{L}\p{N}.,])([+\-−(]?\s*\d(?:[\d., ]*\d)?)\s*(EUR|USD|SEK|GBP|€|\u0024|£)(?![\p{L}\p{N}.,])/giu;
const moneySuffix=/(?:\b(?:EUR|USD|SEK|GBP)\b|[€\u0024£])/giu;
const qtySuffix=/\b(?:kpl|pcs|st)\b/giu;
const currency=s=>s==='€'?'EUR':s==='£'?'GBP':
  s===String.fromCharCode(36)?'USD':s.toUpperCase();
function exactSourceNumber(raw,{allowZero=false}={}) {
  const s=normalize(raw);
  // Signed and accounting-style positions are not part of our
  // currently supported long-only holdings grammar. Never strip a sign.
  if(!s||/[+\-−()]/u.test(s))return null;
  // parseNumber intentionally removes spaces. Validate grouping FIRST.
  // "1 101,25" is valid; "1 01,25" is not.
  if(s.includes(' ')&&!/^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/u.test(s))
    return null;
  const p=parseNumber(s);
  return p.status==='valid'&&Number.isFinite(p.value)&&
    (p.value>0||(allowZero&&p.value===0))?p.value:null;
}
function evidence(text,regex,suffix,kind) {
  const s=normalize(text), matches=[...s.matchAll(regex)];
  const entries=matches.map(m=>{
    const numeric=exactSourceNumber(m[1],{allowZero:kind==='money'});
    const outside=s.slice(m.index+m[0].length).trimStart();
    const invalidBracket=outside.startsWith(')');
    if(numeric===null||invalidBracket)
      return {match:m,raw:m[0],status:'invalid',value:null};
    if(kind==='quantity')
      return {match:m,raw:m[0],status:'valid',value:numeric};
    const cents=Math.round(numeric*100);
    if(!Number.isSafeInteger(cents)||Math.abs(cents-numeric*100)>1e-7)
      return {match:m,raw:m[0],status:'invalid',value:null};
    return {match:m,raw:m[0],status:'valid',
      value:{cents,currency:currency(m[2])}};
  });
  // OCR may attach a recognized unit to a malformed preceding expression
  // (e.g. "(4) kpl" or "1.10x,25 EUR"). It must remain evidence of an
  // invalid field rather than vanishing from the decision.
  const unitCount=[...s.matchAll(suffix)].length;
  for(let i=entries.length;i<unitCount;i++)
    entries.push({match:null,raw:s,status:'invalid',value:null});
  return {entries,status:entries.length===0?'missing':
    entries.length>1?'ambiguous':entries[0].status,
    value:entries.length===1&&entries[0].status==='valid'?entries[0].value:null};
}
export function financialQuantityEvidence(text) {
  return evidence(text,QUANTITY,qtySuffix,'quantity');
}
export function financialMoneyEvidence(text) {
  return evidence(text,MONEY,moneySuffix,'money');
}
export function financialQuantityMatches(text) {
  return financialQuantityEvidence(text).entries.filter(x=>x.status==='valid')
    .map(x=>({match:x.match,value:x.value}));
}
export function financialMoneyMatches(text) {
  return financialMoneyEvidence(text).entries.filter(x=>x.status==='valid')
    .map(x=>({match:x.match,value:x.value}));
}
export function uniqueQuantity(text) {
  const e=financialQuantityEvidence(text);
  return e.status==='valid'?{match:e.entries[0].match,value:e.value}:null;
}
export function uniqueMoney(text) {
  const e=financialMoneyEvidence(text);
  return e.status==='valid'?{match:e.entries[0].match,value:e.value}:null;
}
