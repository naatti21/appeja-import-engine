/**
 * Strict, whole-token financial observations for portfolio screenshots.
 * These helpers do not resolve securities or transmit/store any data.
 * Never rescue a partial numeric suffix (e.g. 101,25 from 1.101,25).
 */
import {parseNumber} from './numbers.mjs';
const NORMALIZE=s=>String(s??'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const MONEY=/(?<![\p{L}\p{N}.,+\-−])(\d{1,3}(?:[., ]\d{3})+|\d+)[,.](\d{2})\s*(EUR|USD|SEK|GBP|€|\$|£)(?![\p{L}\p{N}.,])/giu;
const QUANTITY=/(?<![\p{L}\p{N}.,])(\d+(?:[., ]\d+)*)\s*(kpl|pcs|st)\b/giu;
const CURRENCY={'€':'EUR','
const field=(m,kind,text)=>{
 const amount=kind==='money'?m[0].replace(/\s*(EUR|USD|SEK|GBP|€|\$|£)$/iu,'').trim():m[1];
 const parsed=parseNumber(amount);
 if(parsed.status!=='valid'||!Number.isFinite(parsed.value)||
    parsed.value<(kind==='money'?0:Number.EPSILON))return null;
 if(kind==='qty')return {match:m,value:parsed.value};
 const cents=Math.round(parsed.value*100);
 if(!Number.isSafeInteger(cents)||Math.abs(cents-parsed.value*100)>1e-7)return null;
 return {match:m,value:{cents,currency:CURRENCY[m[3]]??m[3].toUpperCase()}};
};
export function financialMoneyMatches(text) {
 const s=NORMALIZE(text);
 // Reject negative monetary tokens even when unsigned suffix would match.
 const matches=[...s.matchAll(MONEY)].filter(m=>!/[+−-]/u.test(s[m.index-1]??''));
 return matches.map(m=>field(m,'money',s)).filter(Boolean);
}
export function financialQuantityMatches(text){
 const s=NORMALIZE(text);
 return [...s.matchAll(QUANTITY)].map(m=>field(m,'qty',s)).filter(Boolean);
}
export function uniqueMoney(text){
 const s=NORMALIZE(text);
 const matches=financialMoneyMatches(s);
 return matches.length===1?matches[0]:null;
}
export function uniqueQuantity(text){
 const s=NORMALIZE(text);
 const matches=financialQuantityMatches(s);
 return matches.length===1?matches[0]:null;
}
:'USD','£':'GBP'};
const field=(m,kind,text)=>{
 const amount=kind==='money'?m[0].replace(/\s*(EUR|USD|SEK|GBP|€|\$|£)$/iu,'').trim():m[1];
 const parsed=parseNumber(amount);
 if(parsed.status!=='valid'||!Number.isFinite(parsed.value)||
    parsed.value<(kind==='money'?0:Number.EPSILON))return null;
 if(kind==='qty')return {match:m,value:parsed.value};
 const cents=Math.round(parsed.value*100);
 if(!Number.isSafeInteger(cents)||Math.abs(cents-parsed.value*100)>1e-7)return null;
 return {match:m,value:{cents,currency:CURRENCY[m[3]]??m[3].toUpperCase()}};
};
export function financialMoneyMatches(text) {
 const s=NORMALIZE(text);
 // Reject negative monetary tokens even when unsigned suffix would match.
 const matches=[...s.matchAll(MONEY)].filter(m=>!/[+−-]/u.test(s[m.index-1]??''));
 return matches.map(m=>field(m,'money',s)).filter(Boolean);
}
export function financialQuantityMatches(text){
 const s=NORMALIZE(text);
 return [...s.matchAll(QUANTITY)].map(m=>field(m,'qty',s)).filter(Boolean);
}
export function uniqueMoney(text){
 const s=NORMALIZE(text);
 const matches=financialMoneyMatches(s);
 return matches.length===1?matches[0]:null;
}
export function uniqueQuantity(text){
 const s=NORMALIZE(text);
 const matches=financialQuantityMatches(s);
 return matches.length===1?matches[0]:null;
}
