/** Real synthetic PDF bytes generated locally, without reading user files. */
const W=1200,H=840;
function bytes(value){return Uint8Array.from(String(value),ch=>{const c=ch.charCodeAt(0);if(c>255)throw new Error('Latin-1 fixture only');return c;});}
function literal(value){
  return [...bytes(value)].map(c=>{
    if(c===40||c===41||c===92)return '\\'+String.fromCharCode(c);
    if(c<32||c>126)return '\\'+c.toString(8).padStart(3,'0');
    return String.fromCharCode(c);
  }).join('');
}
function cell(value,x,y,size=13){
  return 'BT /F1 '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+literal(value)+') Tj ET\n';
}
function pageContent(options={}) {
 const lines=options.lines??['Document ID: DEV-C18','Generated on: 2026-05-09T09:12:00Z','Page 1 of 1','Gross pay 3150,00 EUR','Net pay 2420,00 EUR'];
 return lines.map((raw,i)=>cell(raw,75,780-i*45,16)).join('');
}
export function reviewPdf(pageOptions=[{}]){
  if(!Array.isArray(pageOptions)||!pageOptions.length||pageOptions.length>5)throw new Error('Invalid fixture page count');
  const objects=[];
  const add=x=>(objects.push(x),objects.length);
  const catalog=add(''),pages=add('');
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids=[];
  for(const options of pageOptions){
    const content=pageContent(options);
    const data=add('<< /Length '+bytes(content).length+' >>\nstream\n'+content+'endstream');
    const rotation='';
    const crop='';
    kids.push(add('<< /Type /Page /Parent '+pages+' 0 R /MediaBox [0 0 '+W+' '+H+']'+rotation+crop+' /Resources << /Font << /F1 '+font+' 0 R >> >> /Contents '+data+' 0 R >>'));
  }
  objects[catalog-1]='<< /Type /Catalog /Pages '+pages+' 0 R >>';
  objects[pages-1]='<< /Type /Pages /Kids ['+kids.map(k=>k+' 0 R').join(' ')+'] /Count '+kids.length+' >>';
  let text='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offsets=[];
  for(let i=0;i<objects.length;i++){
    offsets.push(bytes(text).length);
    text+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const startxref=bytes(text).length;
  text+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(const offset of offsets)text+=String(offset).padStart(10,'0')+' 00000 n \n';
  text+='trailer\n<< /Size '+(objects.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+startxref+'\n%%EOF\n';
  return bytes(text);
}
