import {impactCases} from './cases.mjs';
import {auditSourceCoverage as auditParent} from '../coverage-gate-v2/gate.mjs';
import {auditSourceCoverage} from './gate.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const rows=impactCases().map(c=>{
 const before=JSON.stringify(c.input),baseline=auditParent(c.input.layout,c.input.parsed),patched=auditSourceCoverage(c.input.layout,c.input.parsed);
 const passed=patched.canAutoAccept===c.expected.accept&&patched.canPersist===false&&
  c.expected.warnIds.every(id=>patched.newWarnings.some(w=>w.sourceId===id))&&before===JSON.stringify(c.input);
 return {...c,baseline,patched,passed};
});
const summary={controls:rows.length,expectedOutcomePass:rows.filter(r=>r.passed).length,
 expectedOutcomeFail:rows.filter(r=>!r.passed).length,
 positiveControls:rows.filter(r=>!r.compatibility&&r.expected.accept).length,
 positiveControlsAllowed:rows.filter(r=>!r.compatibility&&r.expected.accept&&r.patched.canAutoAccept).length,
 adversarialControls:rows.filter(r=>!r.compatibility&&!r.expected.accept&&r.id!=='upstream-block').length,
 unsafeParentAcceptsBlocked:rows.filter(r=>!r.compatibility&&!r.expected.accept&&r.baseline.canAutoAccept&&!r.patched.canAutoAccept).map(r=>r.id),
 compatibilityProbes:rows.filter(r=>r.compatibility).map(r=>({id:r.id,parent:r.baseline.canAutoAccept,patched:r.patched.canAutoAccept,newFalseBlock:r.baseline.canAutoAccept&&!r.patched.canAutoAccept})),
 productionDecision:'NO-GO',independentQA:'NOT RUN'};
if(process.argv[2]){mkdirSync(process.argv[2],{recursive:true});writeFileSync(process.argv[2]+'/impact.json',JSON.stringify({summary,rows},null,2)+'\n');}
console.log(JSON.stringify(summary,null,2));if(summary.expectedOutcomeFail)process.exitCode=1;
