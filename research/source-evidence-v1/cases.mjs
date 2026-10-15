import {base,d1,observation,SEED} from './fixtures.mjs';
/** Known-answer impact controls, defined from the protocol, never prior EVAL. */
export function impactCases(){
 const rows=[];
 const add=(id,edit,accept,warnIds=[],compatibility=false)=>{
  const input=base();edit(input);rows.push({id,seed:SEED,input,expected:{accept,warnIds},compatibility});
 };
 const typed=(c,key,valueIds,headerIds=[],contextIds=[],context)=>{
  const f=c.parsed.fields[key];f.sourceRoles={valueIds,headerIds,contextIds};f.sourceIds=[...valueIds,...headerIds,...contextIds];
  if(context!==undefined)f.context=context;
 };
 const parts=(c,key,texts,value)=>{
  const f=c.parsed.fields[key],old=f.sourceIds[0],source=c.layout.observations.find(o=>o.id===old);
  c.layout.observations=c.layout.observations.filter(o=>o.id!==old);
  const ids=texts.map((text,i)=>{const id=key+'-part-'+i;c.layout.observations.push(observation(id,text,.25+i*.09,source.box.y0));return id;});
  f.value=value;f.sourceIds=ids;return ids;
 };
 add('legacy-exact',()=>{},true);
 rows.push({id:'D1',seed:SEED,input:d1(),expected:{accept:false,warnIds:['extra-money']},compatibility:false});
 add('extra-unresolved-text',c=>{c.layout.observations.push(observation('extra','Tax pending',.6,.65));c.parsed.fields.payDate.sourceIds.push('extra');},false,['extra']);
 add('extra-numeric-to-money',c=>{c.layout.observations.push(observation('extra','73.21',.5,.3));c.parsed.fields.grossPay.sourceIds.push('extra');},false,['extra']);
 add('extra-unit-to-money',c=>{c.layout.observations.push(observation('extra','EUR',.5,.3));c.parsed.fields.grossPay.sourceIds.push('extra');},false,['extra']);
 add('repeated-date-observation',c=>{c.layout.observations.push(observation('date2','2027-03-19',.5,.2));c.parsed.fields.payDate.sourceIds.push('date2');},false,['date2']);
 add('duplicate-id-membership',c=>c.parsed.fields.payDate.sourceIds.push('date'),false,['date']);
 add('missing-id',c=>c.parsed.fields.payDate.sourceIds.push('absent'),false,['date']);
 add('shared-value-between-fields',c=>c.parsed.fields.netPay={status:'verified',value:3201.25,sourceIds:['gross']},false,['gross']);
 add('declared-heading',c=>{c.layout.observations.push(observation('head','Payment date',.1,.2));typed(c,'payDate',['date'],['head']);},true);
 add('legacy-heading-compatibility',c=>{c.layout.observations.push(observation('head','Payment date',.1,.2));c.parsed.fields.payDate.sourceIds.push('head');},false,[],true);
 add('wrong-header-role',c=>{c.layout.observations.push(observation('head','Gross pay',.1,.2));typed(c,'payDate',['date'],['head']);},false,['head','date']);
 add('extra-money-as-header',c=>{c.layout.observations.push(observation('head','73.21',.1,.2));typed(c,'payDate',['date'],['head']);},false,['head']);
 add('overlap-value-header-membership',c=>typed(c,'payDate',['date'],['date']),false,['date']);
 add('surplus-flat-source-id',c=>{c.layout.observations.push(observation('extra','73.21',.6,.6));typed(c,'payDate',['date']);c.parsed.fields.payDate.sourceIds.push('extra');},false,['extra']);
 add('consistent-currency',c=>{c.layout.observations.push(observation('ctx','EUR',.55,.3));typed(c,'grossPay',['gross'],[],['ctx'],{currency:'EUR'});},true);
 const sharedContext=(c,secondCurrency)=>{
  c.layout.observations.push(observation('ctx','EUR',.55,.3),observation('net','2200.00',.7,.3));
  c.parsed.fields.netPay={status:'verified',value:2200,sourceIds:['net']};
  typed(c,'grossPay',['gross'],[],['ctx'],{currency:'EUR'});
  typed(c,'netPay',['net'],[],['ctx'],{currency:secondCurrency});
 };
 add('shared-consistent-context',c=>sharedContext(c,'EUR'),true);
 add('shared-conflicting-context',c=>sharedContext(c,'USD'),false,['ctx','net']);
 add('contradictory-currency',c=>{c.layout.observations.push(observation('ctx','USD',.55,.3));typed(c,'grossPay',['gross'],[],['ctx'],{currency:'EUR'});},false,['ctx','gross']);
 add('unclaimed-context',c=>{c.layout.observations.push(observation('ctx','EUR',.55,.3));typed(c,'grossPay',['gross'],[],['ctx']);},false,['ctx']);
 add('hidden-money-in-context',c=>{c.layout.observations.push(observation('ctx','EUR 73.21',.55,.3));typed(c,'grossPay',['gross'],[],['ctx'],{currency:'EUR'});},false,['ctx']);
 add('consistent-period',c=>{c.layout.observations.push(observation('ctx','Period: 2027-03',.55,.3));typed(c,'grossPay',['gross'],[],['ctx'],{period:'2027-03'});},true);
 add('contradictory-period',c=>{c.layout.observations.push(observation('ctx','Period: 2027-04',.55,.3));typed(c,'grossPay',['gross'],[],['ctx'],{period:'2027-03'});},false,['ctx']);
 add('distant-global-context-compatibility',c=>{c.layout.observations.push(observation('ctx','EUR',.55,.06));typed(c,'grossPay',['gross'],[],['ctx'],{currency:'EUR'});},false,[],true);
 add('distant-column-heading-compatibility',c=>{c.layout.observations.push(observation('head','Gross pay',.4,.1));typed(c,'grossPay',['gross'],['head']);},false,[],true);
 add('grouped-number-fragments',c=>parts(c,'grossPay',['3','201.25'],3201.25),true);
 add('decimal-fragments',c=>parts(c,'grossPay',['3201','.','25'],3201.25),true);
 add('signed-decimal-fragments',c=>parts(c,'grossPay',['−','12',',','50'],-12.5),true);
 add('date-fragments',c=>parts(c,'payDate',['2027','-','03','-','19'],'2027-03-19'),true);
 add('ambiguous-integer-fragments-compatibility',c=>parts(c,'grossPay',['32','01'],3201),false,[],true);
 add('bad-grouping-token',c=>{c.layout.observations.find(o=>o.id==='gross').raw='32 01.25';},false,['gross']);
 add('overlapping-fragments',c=>{const ids=parts(c,'grossPay',['3','201.25'],3201.25);c.layout.observations.find(o=>o.id===ids[1]).box={...c.layout.observations.find(o=>o.id===ids[0]).box};},false,['grossPay-part-0','grossPay-part-1']);
 add('cross-page-fragments',c=>{const ids=parts(c,'grossPay',['3','201.25'],3201.25);c.layout.observations.find(o=>o.id===ids[1]).page=2;},false,['grossPay-part-1']);
 add('fragment-without-geometry',c=>{const ids=parts(c,'grossPay',['3','201.25'],3201.25);delete c.layout.observations.find(o=>o.id===ids[1]).box;},false,['grossPay-part-1']);
 add('same-value-overlapping-source-boxes',c=>{c.layout.observations.push(observation('gross2','3201.25',.4,.3));c.parsed.fields.netPay={status:'verified',value:3201.25,sourceIds:['gross2']};},false,['gross','gross2']);
 const ledger=c=>{
  ['12345','5','5','25'].forEach((raw,i)=>c.layout.observations.push(observation('r'+i,raw,.1+i*.1,.6)));
  c.parsed.payLines=[{code:'12345',category:'synthetic',quantity:5,unitPrice:5,factor:1,amount:25,sourceIds:['r0','r1','r2','r3']}];
 };
 add('disjoint-payline',ledger,true);
 add('payline-extra-text',c=>{ledger(c);c.layout.observations.push(observation('extra','Tax pending',.6,.6));c.parsed.payLines[0].sourceIds.push('extra');},false,['extra']);
 add('payline-declared-label',c=>{ledger(c);c.layout.observations.push(observation('label','Fixed wage',.01,.6));c.parsed.payLines[0].label='Fixed wage';c.parsed.payLines[0].sourceIds.push('label');},true);
 add('payline-nonstring-label',c=>{ledger(c);c.layout.observations.push(observation('extra','Tax pending',.6,.6));c.parsed.payLines[0].label=12;c.parsed.payLines[0].sourceIds.push('extra');},false,['extra']);
 add('payline-field-value-reuse',c=>{ledger(c);c.parsed.fields.other={status:'verified',value:5,sourceIds:['r1']};},false,['r1']);
 add('pending-payline',c=>{ledger(c);c.parsed.payLines[0].status='pending';},false,['r0']);
 add('upstream-block',c=>{c.parsed.decision.status='review-required';c.parsed.decision.canAutoAccept=false;},false);
 return rows;
}
