/** Synthetic payroll-table geometry experiment, NOT a production payslip parser. */
import {rowTokens} from './layout.mjs';
import {parseNumber} from './numbers.mjs';
import {resolveCandidates,decideSafety} from './evidence.mjs';

const HEADER = [
  [/kertymä\s+palkkakaudelta/i,'grossPay'],
  [/kertymä\s+vuoden\s+alusta/i,'ytdTaxableIncome'],
  [/kertymä\s+edellis(?:eltä|eltä)\s+vuodelta/i,'previousYearTaxableIncome']
];
const moneyLabel = /(?:ver\.?\s*al\.?\s*ans\.?|veronalainen\s+ansio)/i;
function headerRole(text) { return HEADER.find(([re]) => re.test(text))?.[1] ?? null; }
const essential = ['grossPay','ytdTaxableIncome'];

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
      const headers = current.tokens.map(t=>({token:t,role:headerRole(t.raw)})).filter(h=>h.role);
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
      const nextHeader = rows.findIndex((r, j)=>j>i && r.tokens.some(t=>headerRole(t.raw)));
      const stop = nextHeader<0 ? rows.length:nextHeader;
      let foundData=false;
      for(let j=i+1;j<stop;j++) {
        const r=rows[j];
        if (r.row.y-current.row.y>0.16) break;
        if (!r.tokens.some(t=>moneyLabel.test(t.raw))) continue;
        foundData=true;
        const numeric = r.tokens.filter(t=>!moneyLabel.test(t.raw)).map(t=>({token:t,parsed:parseNumber(t.raw)}));
        const seen=new Set();
        for (const cell of numeric) {
          if (cell.parsed.status !== 'valid' || cell.parsed.value < 0) {
            unmatched.push({observationId:cell.token.id,raw:cell.token.raw,reason:cell.parsed.value < 0 ? 'negative-money' : cell.parsed.status,tableId});
            issues.push({code:'INVALID_MONEY_CELL',page:page.page,tableId,observationId:cell.token.id});
            continue;
          }
          const ordered = [...headers].sort((a,b)=>a.token.box.x0-b.token.box.x0);
          const x=cell.token.box.x0;
          const col = ordered.findIndex((h,k)=>x < (ordered[k+1]?.token.box.x0 ?? 2));
          if (col<0 || x < ordered[0].token.box.x0 - 0.05) {
            unmatched.push({observationId:cell.token.id,raw:cell.token.raw,reason:'outside-columns',tableId});
            issues.push({code:'UNASSIGNED_MONEY_CELL',page:page.page,tableId,observationId:cell.token.id});
            continue;
          }
          const role=ordered[col].role;
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
