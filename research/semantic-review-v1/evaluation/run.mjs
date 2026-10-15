/** Run only after candidate freeze. Never import this from development tests. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {classifySources} from '../classify.mjs';
import {auditSourceCoverage} from '../../coverage-gate-v2/gate.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const lock=JSON.parse(read('evaluation/LOCK.json'));
for(const [file,hash]of Object.entries(lock))assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash,'Preregistered input changed: '+file);
const freeze=JSON.parse(read('evaluation/FREEZE.json'));
for(const [file,hash]of Object.entries(freeze.files))assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash,'Frozen candidate changed: '+file);
const cases=JSON.parse(read('evaluation/cases.json'));
const metric=()=>({essential:0,warnedEssential:0,benign:0,warnedBenign:0,benignDocuments:0,blockedBenignDocuments:0,falseAcceptance:0});
const current=metric(),baseline=metric(),results=[];
function score(m,c,warnings,blocked,accept){
 const essential=c.rows.filter(r=>r.oracle==='essential'),benign=c.rows.filter(r=>r.oracle==='benign');
 m.essential+=essential.length;m.warnedEssential+=essential.filter(r=>warnings.has(r.id)).length;
 m.benign+=benign.length;m.warnedBenign+=benign.filter(r=>warnings.has(r.id)).length;
 if(!essential.length){m.benignDocuments++;if(blocked)m.blockedBenignDocuments++;}
 if((essential.length&&!blocked)||accept)m.falseAcceptance++;
}
for(const c of cases){
 const layout={sourceKind:'pdf-text',pages:[{page:1}],issues:[],unplacedObservations:[],observations:c.rows.map((r,i)=>({id:r.id,raw:r.raw,page:1,box:{x0:.1,x1:.85,y0:.1+i*.1,y1:.125+i*.1}}))};
 const original=structuredClone(layout),r=classifySources(layout);assert.deepEqual(layout,original);assert.deepEqual(r.observations,original.observations);assert.deepEqual(r.entries.map(e=>e.sourceId),c.rows.map(x=>x.id));
 const w=new Set(r.entries.filter(e=>e.requiresCorrection).map(e=>e.sourceId));
 const b=auditSourceCoverage(layout,{fields:{},payLines:[],decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}}),bw=new Set([...b.newWarnings,...b.existingWarnings].map(e=>e.sourceId));
 score(current,c,w,r.correctionRequired,r.canAutoAccept||r.canPersist);score(baseline,c,bw,!b.canAutoAccept,false);
 results.push({id:c.id,seed:c.seed,expected:c.rows.map(({id,oracle})=>({id,oracle})),observed:r.entries,blocked:r.correctionRequired,baselineWarnings:[...bw]});
}
function verdict(m){return {coverage:m.warnedEssential/m.essential,nuisanceRate:m.warnedBenign/m.benign,falseBlockRate:m.blockedBenignDocuments/m.benignDocuments,pass:m.warnedEssential===m.essential&&m.warnedBenign/m.benign<=.1&&m.blockedBenignDocuments/m.benignDocuments<=.1&&m.falseAcceptance===0};}
const verdicts={candidate:verdict(current),baseline:verdict(baseline)};
console.log(JSON.stringify({protocolLock:lock,freeze,current,baseline,verdicts,results,scope:'new synthetic source envelopes; no external independent QA; false acceptance includes triage misses, not just disabled save button'},null,2));
if(!verdicts.candidate.pass)process.exitCode=1;
