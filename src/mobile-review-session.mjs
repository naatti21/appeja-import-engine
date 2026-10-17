/** Ephemeral source corrections. Never export this draft as a learning profile. */
import {createReviewDraft,correctReviewField,reviewFieldSources} from './review-draft.mjs';
import {mobileSourceLines,resolveMobileCards} from './mobile-card-holdings.mjs';
import {parseNumber} from './numbers.mjs';

const keys={name:'text',identity:'identity',quantity:'measure'};
const clone=v=>structuredClone(v);
export function createMobileReviewSession(source) {
  const original=clone(source), lines=mobileSourceLines(original);
  const records=lines.map((line,i)=>({id:`line-${i}`,fields:{text:{value:line.text,status:'unverified',sourceIds:line.ids}}}));
  let draft=createReviewDraft({documentType:'mobile-holdings-source',source:original,records});
  const edits=new Map();
  function project(){
    const projected=clone(original), corrections=new Map();
    for(const [index,edit] of edits){
      const line=lines[index], ids=new Set(line.ids), first=line.ids[0];
      const words=original.observations.filter(o=>ids.has(o.id));
      const box={x0:Math.min(...words.map(o=>o.source.box.x0)),x1:Math.max(...words.map(o=>o.source.box.x1)),y0:line.y0,y1:line.y1};
      projected.observations=projected.observations.filter(o=>!ids.has(o.id)||o.id===first);
      const o=projected.observations.find(o=>o.id===first);
      o.raw=edit.projectedText;o.source.box=box;o.identityDisagreement=false;
      corrections.set(first,{sourceIds:[...line.ids],field:edit.field});
    }
    return {source:projected,corrections};
  }
  return {
    snapshot(){return {...clone(draft),corrections:[...edits].map(([line,e])=>({line,field:e.field,value:e.value,sourceIds:[...lines[line].ids]}))};},
    lines(){return lines.map((line,i)=>({...clone(line),index:i,correction:edits.has(i)?clone(edits.get(i)):null}));},
    sources(index){return reviewFieldSources(draft,`line-${index}`,'text');},
    resolve(learner){const p=project();return resolveMobileCards(p.source,learner,p.corrections);},
    correct({line:index,field,value,confirmed}){
      if(confirmed!==true)throw Error('EXPLICIT_USER_CONFIRMATION_REQUIRED');
      const line=lines[index];
      if(!line||!Object.hasOwn(keys,field)||typeof value!=='string'||value.trim().length>120||!value.trim())throw Error('INVALID_CORRECTION');
      // One line only. Never allow current price/value/day-return/account/menu roles to become quantity or identity.
      if(line.split)throw Error('AMBIGUOUS_SOURCE_GEOMETRY');
      const previous=edits.get(index);
      if(previous&&previous.field!==field)throw Error('CORRECTION_ROLE_CONFLICT');
      if(!['text','unknown',keys[field]].includes(line.role))throw Error('SOURCE_ROLE_CONFLICT');
      value=value.trim();let projectedText=value;
      if(field==='quantity'){
        const n=parseNumber(value);if(n.status!=='valid'||!(n.value>0))throw Error('INVALID_QUANTITY');
        projectedText=`Quantity: ${value}`;
      }else if(field==='identity'){
        // Accept a complete source identifier, not a replacement character rule.
        const probe=clone(original.observations.find(o=>o.id===line.ids[0]));probe.raw=value;
        if(mobileSourceLines({...original,observations:[probe],issues:[]})[0]?.role!=='identity')throw Error('INVALID_IDENTITY');
      }else if(!/\p{L}/u.test(value)||/[\r\n]/.test(value))throw Error('INVALID_NAME');
      // Keep original OCR source + initial suggested text in the shared review-draft contract.
      draft=correctReviewField(draft,{recordId:`line-${index}`,fieldName:'text',value,confirmed:true});
      edits.set(index,{field,value,projectedText});return this.snapshot();
    },
    undo(index){edits.delete(index);draft=createReviewDraft({documentType:'mobile-holdings-source',source:original,records});
      for(const [i,e] of edits)draft=correctReviewField(draft,{recordId:`line-${i}`,fieldName:'text',value:e.value,confirmed:true});},
  };
}
