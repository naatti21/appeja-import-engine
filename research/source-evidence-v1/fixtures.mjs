/** Fresh minimal hand-built oracle controls; no imports of prior generators/EVAL. */
export const SEED=101015;
export function observation(id,raw,x=.4,y=.2,page=1){return {id,raw,page,box:{x0:x,y0:y,x1:x+.07,y1:y+.016},material:false};}
export function base(){
 return {layout:{observations:[observation('date','2027-03-19'),observation('gross','3201.25',.4,.3)]},
 parsed:{fields:{payDate:{status:'verified',value:'2027-03-19',sourceIds:['date']},grossPay:{status:'verified',value:3201.25,sourceIds:['gross']}},
 payLines:[],decision:{status:'candidate-ready',canAutoAccept:true,canPersist:false,problems:[]}}};
}
export function d1(){const c=base();c.layout.observations.push(observation('extra-money','73.21',.6,.65));c.parsed.fields.payDate.sourceIds.push('extra-money');return c;}
