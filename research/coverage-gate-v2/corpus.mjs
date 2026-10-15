/** New synthetic envelope/oracle generator. Contains no import of a gate or previous corpus. */
export const SEEDS={dev:902101,eval:902903};
export const FAMILIES=['amount','unknown-text','split','unicode','already-warned','fake-accounted',
 'forged-field','pending-payline','page-footer','document-id','footer-money','metadata-money',
 'repeated-amount','version-heading','context-text','inconsistent-decision','blocked-upstream','archive-number'];
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};}
export function createCorpus(split){
 if(!(split in SEEDS))throw new Error('UNKNOWN_SPLIT');
 const rand=random(SEEDS[split]),cases=[];
 for(const family of FAMILIES)for(let variant=0;variant<5;variant++){
  const id=`${split}-${family}-${variant}`, observations=[],annotations={};
  const token=(raw,role,y=.5,x=.1,page=1)=>{
   const sourceId=`src-${Math.floor(rand()*1e9)}-${observations.length}`;
   observations.push({id:sourceId,raw,page,box:{x0:x,y0:y,x1:Math.min(.98,x+.12),y1:y+.012},method:'synthetic-envelope',material:false});
   annotations[sourceId]=role;return sourceId;
  };
  const values={payDate:'2027-02-18',grossPay:3127.25,netPay:2314.12,ytdTaxableIncome:18270.4};
  const fields={};let y=.12;
  for(const [name,value]of Object.entries(values)){
   const sid=token(String(value),'linked',y,.4);y+=.045;
   fields[name]={status:'verified',value,sourceIds:[sid]};
  }
  const parsed={fields,payLines:[],decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}};
  const amount=(Math.floor(rand()*95000)+1101)/100;
  const money=variant%2?amount.toFixed(2).replace('.',','):amount.toFixed(2);
  const page=1+variant%2;
  // Every document has varied benign metadata; some deliberately lack safe classification.
  token(['Sivu 1 / 2','Page 1 of 2','Sida 1 av 2'][variant%3],'nuisance',.955,.76);
  token('Document ID: SYN-'+Math.floor(rand()*1e6),'nuisance',.035,.1);
  token('SYNTHETIC TEST DOCUMENT','nuisance',.06,.1);
  switch(family){
   case 'amount': token(money,'essential',.45,.6,page);break;
   case 'unknown-text': token(['Gross amount pending','Hankintahinta puuttuu','Belopp saknas','Allowance unresolved','Verokertymä epäselvä'][variant],'essential',.45,.2,page);break;
   case 'split': ['−',String(variant+1),'234,50','EUR'].forEach((raw,i)=>token(raw,'essential',.45,.25+i*.1,page));break;
   case 'unicode': token(['１２３．４５','١٢٣٫٤٥','१२३.४५','۹۸٫۷۶','１２３'][variant],'essential',.45,.5,page);break;
   case 'already-warned':{const sid=token(money,'essential');parsed.decision.problems.push({code:'UNACCOUNTED_MATERIAL',detail:sid});parsed.decision.status='review-required';parsed.decision.canAutoAccept=false;break;}
   case 'fake-accounted':{const sid=token(money,'essential');parsed.accountedEvidenceIds=[sid];break;}
   case 'forged-field':{const sid=fields.grossPay.sourceIds[0];annotations[sid]='essential';fields.grossPay.value=9981.11;break;}
   case 'pending-payline':{const sid=token(money,'essential');parsed.payLines.push({status:'pending',sourceIds:[sid],amount});break;}
   case 'page-footer':token('Page 2 of 2','nuisance',.955,.6,2);break;
   case 'document-id':token('Document ID: SYN-'+Math.floor(rand()*1e6),'nuisance',.075,.1);break;
   case 'footer-money':token(money+' EUR','essential',.955,.45,page);break;
   case 'metadata-money':token('Document ID: '+money+' EUR','essential',.035,.5,page);break;
   case 'repeated-amount':token(money,'essential',.45,.5,1);token(money,'essential',.45,.5,2);break;
   case 'version-heading':token('Version: '+(variant+1)+'.2','nuisance',.075,.5);break;
   case 'context-text':token(['Amount','Määrä','Belopp','Rate','Hankintameno'][variant],'context',.45,.1,page);token(['to be agreed','SOVITAAN','SAKNAS','unknown','selvitettävä'][variant],'essential',.45,.5,page);break;
   case 'inconsistent-decision':{const sid=token(money,'essential');parsed.decision.problems.push({code:'UNACCOUNTED_MATERIAL',detail:sid});break;}
   case 'blocked-upstream':parsed.decision.status='review-required';parsed.decision.canAutoAccept=false;parsed.decision.problems.push({code:'UPSTREAM_CONFLICT'});break;
   case 'archive-number':token('Archive copy '+Math.floor(rand()*9999),'nuisance',.075,.5);break;
  }
  // Source order is independent of reading order and family, never a semantic link signal.
  for(let i=observations.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[observations[i],observations[j]]=[observations[j],observations[i]];}
  cases.push({id,seed:SEEDS[split],family,variant,layout:{observations},parsed,oracle:{annotations}});
 }
 return cases;
}
