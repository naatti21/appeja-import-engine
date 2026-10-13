// Environment-only standard Uint8Array#toHex shim for Node 24.
// No PDF.js or Import Engine files are modified.
if(typeof Uint8Array.prototype.toHex!=='function'){
 Object.defineProperty(Uint8Array.prototype,'toHex',{configurable:true,writable:true,value:function(){
  let out='';for(let i=0;i<this.length;i++)out+=this[i].toString(16).padStart(2,'0');return out;
 }});
}
if(new Uint8Array([0,15,255]).toHex()!=='000fff')throw Error('toHex shim check failed');
