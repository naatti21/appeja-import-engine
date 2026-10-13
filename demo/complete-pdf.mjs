/**
 * Synthetic text-fixture -> actual single-page WinAnsi PDF bytes.
 * This is a test fixture generator only: no uploads, no real files, no persistence.
 */
const W=595,H=842;
const special=new Map([['€',0x80],['–',0x96],['—',0x97],['™',0x99]]);
function cp1252(value){
 const output=[];
 for(const ch of String(value)){
  const code=special.get(ch)??ch.codePointAt(0);
  if(code>255)throw new Error('Unsupported synthetic fixture character: U+'+code.toString(16));
  output.push(code);
 }
 return output;
}
function pdfLiteral(value){
 return cp1252(value).map(code=>{
  if(code===40||code===41||code===92)return '\\'+String.fromCharCode(code);
  if(code<32||code>126)return '\\'+code.toString(8).padStart(3,'0');
  return String.fromCharCode(code);
 }).join('');
}
function latin1Bytes(s){return Uint8Array.from([...s].map(ch=>{
 const c=ch.codePointAt(0);
 if(c>255)throw new Error('Unexpected PDF serialization character');
 return c;
}));}
export function completePayslipPdf(text){
 if(typeof text!=='string'||!text.trim())throw new Error('Synthetic document text missing');
 const lines=text.replace(/\r\n?/g,'\n').split('\n');
 if(lines.length>44)throw new Error('Fixture too many lines for one page');
 const content='BT\n/F1 9.5 Tf\n1 0 0 1 42 800 Tm\n16 TL\n'+
   lines.map(line=>'('+pdfLiteral(line)+') Tj\nT*\n').join('')+'ET\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  '<< /Length '+latin1Bytes(content).length+' >>\nstream\n'+content+'endstream',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
 ];
 let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[];
 for(let i=0;i<objects.length;i++){
  offsets.push(latin1Bytes(out).length);
  out+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const startxref=latin1Bytes(out).length;
 out+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets)out+=String(offset).padStart(10,'0')+' 00000 n \n';
 out+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+startxref+'\n%%EOF\n';
 return latin1Bytes(out);
}
