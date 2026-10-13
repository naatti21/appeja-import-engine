/** Synthetic payroll-table geometry experiment, NOT a production payslip parser. */
import {rowTokens} from './layout.mjs';
import {parseNumber} from './numbers.mjs';
import {resolveCandidates,decideSafety} from './evidence.mjs';

const HEADER = [
  [/kertymä\s+palkkakaudelta/i,'grossPay'],
  [/kertymä\s+vuoden\s+alusta/i,'ytdTaxableIncome'],
  [/kertymä\s+edellis(?:eltä|eltä)\s+vuodelta/i,'previousYearTaxableIncome']
];
const moneyLabel = /(?:ver\.?\s*al\.?\s*ans\.?|veronalainen\s+ansio|ennakonpid(?:ä|\.)?\s*\.?\s*al\.?\s*tul(?:o)?)/i;
function headerRole(text) { return HEADER.find(([re]) => re.test(text))?.[1] ?? null; }
const essential = ['grossPay','ytdTaxableIncome'];

/** Reconstruct only tightly adjacent fragments of a known header; source tokens remain unchanged. */
function detectHeaders(tokens) {
  const ordered = tokens.filter(t=>t.box).sort((a,b)=>a.box.x0-b.box.x0);
  const headers=[];
  for(let i=0;i<ordered.length;i++) {
    let phrase='',last=null;
    for(let j=i;j<Math.min(ordered.length,i+4);j++) {
      const item=ordered[j];
      if(last && item.box.x0-last.box.x1>0.025) break;
      phrase+=(phrase?' ':'')+item.raw.trim();
      const role=headerRole(phrase);
      if(role){
        headers.push({role,token:ordered[i],sourceIds:ordered.slice(i,j+1).map(t=>t.id)});
        i=j; break;
      }
      last=item;
    }
  }
  return headers;
}

/** Never assign a number to a remote or geometrically ambiguous column. */
function locateColumn(cell,orderedHeaders) {
  const distances=orderedHeaders.map(h=>({role:h.role,d:Math.abs(cell.box.x0-h.token.box.x0)}))
    .sort((a,b)=>a.d-b.d);
  if(!distances.length || distances[0].d>0.075) return null;
  if(distances.length>1 && distances[1].d-distances[0].d<0.02) return null;
  return distances[0].role;
}

export function parsePayrollLayout(layout) {
  const issues = [...(layout.issues ?? [])];
  const evidence = { grossPay:[], ytdTaxableIncome:[],previousYearTaxableIncome:[] };
  const unmatched = [];
  const tokensById = new Map(layout.observations.map(t=>[t.id,t]));
  let blocks=0;
  for (const page of layout.pages) {
    const rows = page.rows.map(row=>({row,tokens:rowTokens(layout,row)}));
    for (let i=0; i<rows.length; i++) {
      const current = rows[i];
      const headers = detectHeaders(current.tokens);
      if (!headers.length) continue;
      blocks++;
      const tableId=`p${page.page}-block${blocks}`;
      if (new Set(headers.map(h=>h.role)).size !== headers.length) {
        issues.push({code:'DUPLICATE_TABLE_COLUMN',page:page.page,tableId});
        // Still inspect observations for loss; no ambiguous allocation is accepted.
      }
      if (!essential.every(role=>headers.some(h=>h.role===role))) {
        issues.push({code:'INCOMPLETE_TABLE_HEADER',page:page.page,tableId});
      }
      const nextHeader = rows.findIndex((r, j)=>j>i && detectHeaders(r.tokens).length>0);
      const stop = nextHeader<0 ? rows.length:nextHeader;
      let foundData=false;
      for(let j=i+1;j<stop;j++) {
        const r=rows[j];
        if (r.row.y-current.row.y>0.16) break;
        if (!r.tokens.some(t=>moneyLabel.test(t.raw))) {
          // Money-like text inside a known table has not been accounted for.
          // Do not accidentally bless a partially parsed table.
          for(const t of r.tokens){
            if(parseNumber(t.raw).status==='valid' || parseNumber(t.raw).status==='ambiguous'){
              unmatched.push({observationId:t.id,raw:t.raw,reason:'unanchored-table-amount',tableId});
              issues.push({code:'UNANCHORED_MONEY_ROW',page:page.page,tableId,observationId:t.id});
            }
          }
          continue;
        }
        foundData=true;
        const numeric = r.tokens.filter(t=>!moneyLabel.test(t.raw)).map(t=>({token:t,parsed:parseNumber(t.raw)}));
        const seen=new Set();
        for (const cell of numeric) {
          if (cell.parsed.status !== 'valid' || cell.parsed.value < 0) {
            unmatched.push({observationId:cell.token.id,raw:cell.token.raw,reason:cell.parsed.value < 0 ? 'negative-money' : cell.parsed.status,tableId});
            issues.push({code:'INVALID_MONEY_CELL',page:page.page,tableId,observationId:cell.token.id});
            continue;
          }
          const role=locateColumn(cell.token,headers);
          if (!role) {
            unmatched.push({observationId:cell.token.id,raw:cell.token.raw,reason:'ambiguous-or-distant-column',tableId});
            issues.push({code:'AMBIGUOUS_MONEY_COLUMN',page:page.page,tableId,observationId:cell.token.id});
            continue;
          }
          if(seen.has(role)) issues.push({code:'MULTIPLE_VALUES_IN_ONE_COLUMN',page:page.page,tableId,role});
          seen.add(role);
          evidence[role].push({
            status:'valid',value:cell.parsed.value,raw:cell.token.raw,
            observationId:cell.token.id,page:page.page,tableId,columnRole:role
          });
        }
        for (const h of headers) if(!seen.has(h.role)) issues.push({code:'MISSING_TABLE_VALUE',page:page.page,tableId,role:h.role});
      }
      if(!foundData) issues.push({code:'MISSING_TABLE_DATA_ROW',page:page.page,tableId});
    }
  }
  if (!blocks) issues.push({code:'NO_SUPPORTED_PAYROLL_TABLE'});
  const fields=Object.fromEntries(Object.entries(evidence).map(([k,items])=>[k,resolveCandidates(items,{required:essential.includes(k)})]));
  const decision=decideSafety(fields,issues,essential);
  return {schemaVersion:1,adapter:'payroll-geometry-experiment',blocks,
    fields,issues,unmatched,observationCount:tokensById.size,...decision};
}
