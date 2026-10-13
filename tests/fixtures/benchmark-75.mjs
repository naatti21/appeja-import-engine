import {layoutCases} from './layout-cases.mjs';

// These are 25 controlled layout configurations, NOT 25 independently sampled employers.
// Keep the v0.3 positives, then add eight compound/repeated-but-safe configurations.
const originals=layoutCases.filter(c=>c.safe).map(c=>({id:c.id,pages:c.pages,values:c.values}));
const variants=[
  {id:'18-reverse-gross-shift',pages:[{reverse:true,offsets:{gross:20}}]},
  {id:'19-reverse-ytd-shift',pages:[{reverse:true,offsets:{ytd:-20}}]},
  {id:'20-two-page-split-ytd',pages:[{}, {splitHeader:'ytd'}]},
  {id:'21-three-page-reversed',pages:[{}, {reverse:true},{}]},
  {id:'22-previous-right-shift',pages:[{offsets:{previous:22}}]},
  {id:'23-ytd-and-gross-shifts',pages:[{offsets:{ytd:-20,gross:20}}]},
  {id:'24-reversed-noise-above',pages:[{reverse:true,noiseAbove:true}]},
  {id:'25-split-gross-reversed',pages:[{splitHeader:'gross',reverse:true}]}
].map(v=>({...v,values:{ytd:42000,gross:3200,previous:38000}}));
export const baseLayouts=[...originals,...variants];
if(baseLayouts.length!==25||new Set(baseLayouts.map(c=>c.id)).size!==25)throw Error('Expected 25 base layouts');
const extra=(base,problem)=>{
  // Add a clean additional page. On the missing case, the missing value is
  // visible as a structural omission even if other pages contain a unique YTD.
  const ytd=base.values.ytd===43000?'42 000,00':'43 000,00';
  const money=n=>Number(n).toLocaleString('fi-FI',{minimumFractionDigits:2,maximumFractionDigits:2});
  return {taxableLabel:'palkka',gross:money(base.values.gross),previous:money(base.values.previous),
    ...(problem==='conflicting-ytd'?{ytd}:{includeYtd:false})};
};
export const scenarios=baseLayouts.flatMap(base=>[
  {id:base.id+'--clean',kind:'clean',baseId:base.id,
    pages:base.pages.map((p,i)=>({...p,taxableLabel:'palkka',fullSlip:i===0})),
    oracle:{safe:true,...base.values}},
  {id:base.id+'--conflicting-ytd',kind:'conflicting-ytd',baseId:base.id,
    pages:[...base.pages.map((p,i)=>({...p,taxableLabel:'palkka',fullSlip:i===0})),extra(base,'conflicting-ytd')],
    oracle:{safe:false,problem:'conflict'}},
  {id:base.id+'--missing-ytd',kind:'missing-ytd',baseId:base.id,
    pages:[...base.pages.map((p,i)=>({...p,taxableLabel:'palkka',fullSlip:i===0})),extra(base,'missing-ytd')],
    oracle:{safe:false,problem:'MISSING_TABLE_VALUE'}}
]);
if(scenarios.length!==75 || new Set(scenarios.map(s=>s.id)).size!==75)throw Error('Expected 75 unique scenarios');
