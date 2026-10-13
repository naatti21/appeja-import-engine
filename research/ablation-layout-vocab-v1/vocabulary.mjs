// Text interpretation only. Never reorders observations or rows.
// Source: task YÖAJO 05 examples, v0.7 concepts, and public DEV heading surface text.
// No truth values, identifiers, coordinates or payline codes are used.
export const ALIASES = [
  {role:'payDate', re:/^(?:palkkapäivä|payment date|pay date)\s+/i, canonical:'Maksupäivä '},
  {role:'grossPay', re:/^(?:bruttopalkka|ansiot yhteensä|gross pay|brutto\s*\/\s*gross)\s+/i, canonical:'Kauden veronalainen palkka '},
  {role:'netPay', re:/^(?:maksettava palkka|net pay|net)\s+/i, canonical:'Nettopalkka '},
  {role:'ytdTaxableIncome', re:/^(?:veronalainen\s*\/\s*YTD|veronalainen palkkakertymä|YTD taxable income|taxable YTD|vuoden veronalaiset)\s+/i, canonical:'Vuoden veronalainen tulo '}
];
export function normalizeSemanticRow(text,layout,context={}) {
  // Same document-type evidence as original adapter. No inference from amounts.
  if(!layout.observations.some(o=>/palkkalaskelma|palkkaerittely|palkanmaksun\s+yhteenveto/i.test(o.raw)))return text;
  // Tax-card/previous-year phrases must not become current taxable payroll income.
  if(/verokort|tax[- ]?card|previous year|edellis(?:en|vuoden)|tilisiirto/i.test(text))return text;
  const a=ALIASES.find(a=>a.re.test(text));
  if(!a)return text;
  if(context.semanticScope==='excluded'||a.role==='grossPay'&&context.section==='year')return text;
  let tail=text.replace(a.re,'');
  if(a.role==='payDate'){
    const m=tail.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)tail=`${m[3]}.${m[2]}.${m[1]}`;
  }
  return a.canonical+tail;
}
