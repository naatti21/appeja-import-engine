/** YÖAJO 14 — fresh hand-authored source annotations. These are not PDFs.
 * All oracles are explicitly declared here, never inferred from candidate output.
 * New families; same author as evaluation harness, so not independent QA.
 */
const FAMILIES=[
 {id:'employment-reference',type:'benign',observations:[
  ['Employment certificate REF-HR-205','nuisance','top'],
  ['HR unit 17/4','nuisance','middle'],
  ['Issued electronically, revision 2','nuisance','footer']]},
 {id:'legal-notice-footer',type:'benign',observations:[
  ['Regulation 2016/679, article 12','nuisance','top'],
  ['Appeal within 30 days','nuisance','middle'],
  ['Notice reference LEG-2026-91','nuisance','footer']]},
 {id:'archive-disposition',type:'benign',observations:[
  ['Archive transfer batch 7042','nuisance','top'],
  ['Retention class B/12','nuisance','middle'],
  ['Document ID: SYN-ARC-4','nuisance','footer']]},
 {id:'portfolio-cover',type:'benign',observations:[
  ['Annual investment overview Q3/2026','nuisance','top'],
  ['Client copy; not a trading confirmation','nuisance','middle'],
  ['Broker statement page 04','nuisance','footer']]},
 {id:'warehouse-delivery',type:'benign',observations:[
  ['Delivery docket 43842','nuisance','top'],
  ['Bay C-7, package 03/12','nuisance','middle'],
  ['Inventory tracking no. 305-922','nuisance','footer']]},
 {id:'account-cover-letter',type:'benign',observations:[
  ['Account correspondence file SYN-LET-22','nuisance','top'],
  ['Review period 2026-Q4','nuisance','middle'],
  ['This cover note contains no account movements','nuisance','footer']]},
 {id:'payroll-adjustment-appendix',type:'essential',observations:[
  ['Overtime correction +125.00','essential','middle'],
  ['Withholding adjustment -21.00','essential','footer'],
  ['HR transaction reference ADJ-56','nuisance','top']]},
 {id:'broker-transaction-memo',type:'essential',observations:[
  ['Commission charged 3.50','essential','middle'],
  ['FX reference rate 1.08','essential','footer'],
  ['Execution ID BROK-2026-42','nuisance','top']]},
 {id:'expense-reimbursement-claim',type:'essential',observations:[
  ['Travel reimbursement 48.20','essential','middle'],
  ['Unpaid parking 8.00','essential','footer'],
  ['Cost center 44/1','nuisance','top']]},
 {id:'bilingual-statement-annex',type:'essential',observations:[
  ['Tilin saldo 133.20','essential','middle'],
  ['Avgift / Fee 2.50','essential','footer'],
  ['Sida 1 av 3 - ARK-2','nuisance','top']]},
 {id:'portfolio-valuation-note',type:'essential',observations:[
  ['Market value 254.15','essential','middle'],
  ['Unrealized profit 16.20','essential','footer'],
  ['Print template version 3.5','nuisance','top']]},
 {id:'tax-amendment-letter',type:'essential',observations:[
  ['Taxable correction 71.90','essential','middle'],
  ['Additional deduction -14.40','essential','footer'],
  ['Administrative filing TAX-2026-C4','nuisance','top']]}
];
const pos={top:.075,middle:.32,footer:.83};
const box=(x,y,w=.16)=>({x0:x,y0:y,x1:x+w,y1:y+.015});
function build(def,variant){
  const shift=[0,.018,-.012][variant],number=3200+variant*73;
  const linked=def.id+'-v'+variant+'-linked';
  const observations=[{id:linked,raw:number.toFixed(2),kind:'text',
     page:1,box:box(.66,.52+shift,.15),method:'fictional-enveloped-token'}];
  const annotation={};annotation[linked]='linked';
  def.observations.forEach(([raw,oracle,at],i)=>{
    const id=def.id+'-v'+variant+'-obs'+(i+1);
    observations.push({id,raw,page:1,kind:'text',method:'fictional-enveloped-token',
      box:box(.10+(variant%2)*.018,pos[at]+shift+i*.003,.27)});
    annotation[id]=oracle;
  });
  if(variant===1)observations.reverse();
  if(variant===2)observations.push(observations.shift());
  return {id:def.id+'-v'+variant,family:def.id,familyType:def.type,variant,
    layout:{sourceKind:'synthetic-source-envelope',schemaVersion:1,observations,
      pages:[{page:1}],issues:[],unplacedObservations:[]},
    parsed:{fields:{sampleValue:{status:'verified',value:number,
      sourceIds:[linked]}},payLines:[],decision:{status:'candidate-ready',
        canAutoAccept:true,canPersist:false,problems:[]}},
    annotations:annotation};
}
export function newFamilyCases(){
 return FAMILIES.flatMap(def=>[0,1,2].map(i=>build(def,i)));
}
export const expectedDesign={families:12,variantsPerFamily:3,documents:36,
  benignFamilies:6,essentialFamilies:6,benignDocuments:18,essentialDocuments:18};
