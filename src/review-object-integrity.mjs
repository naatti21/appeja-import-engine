/** Deterministic plain-data fingerprint: never invoke getters or toJSON hooks. */
export function reviewFingerprint(value) {
 const seen=new Set();
 function encode(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
  if(!x||typeof x!=='object'||seen.has(x))throw Error('NON_PLAIN_REVIEW');
  const array=Array.isArray(x),prototype=Object.getPrototypeOf(x);
  if(prototype!==(array?Array.prototype:Object.prototype))throw Error('NON_PLAIN_REVIEW');
  seen.add(x);
  const keys=Reflect.ownKeys(x).filter(k=>!(array&&k==='length')).sort();
  const entries=keys.map(k=>{
   const descriptor=Object.getOwnPropertyDescriptor(x,k);
   if(typeof k!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('NON_PLAIN_REVIEW');
   return JSON.stringify(k)+':'+encode(descriptor.value);
  });
  seen.delete(x);return (array?'array:'+x.length+':':'object:')+'{'+entries.join(',')+'}';
 }
 try{return encode(value);}catch{return null;}
}
