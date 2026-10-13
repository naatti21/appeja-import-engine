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
function pageContent(o={}){
  const gross=o.gross??'3 200,00',ytd=o.ytd??'42 000,00',prev=o.previous??'38 000,00';
  let out=cell('TEST DATA - SYNTHETIC ONLY',75,785,15);
  if(o.fullSlip){
    out+=cell('Palkkalaskelma',75,764);
    out+=cell('Palkkakausi 01.10.2026 - 13.10.2026',75,742);
    out+=cell('Maksupäivä 13.10.2026',75,720);
    out+=cell('Maksetaan 2 450,00',75,699);
  }
  if(o.noiseAbove)out+=cell('99 999,00',570,745);
  const header=[
    {label:'Kertymä palkkakaudelta',role:'gross',value:gross},
    {label:'Kertymä vuoden alusta',role:'ytd',value:ytd},
    {label:'Kertymä edelliseltä vuodelta',role:'previous',value:prev}
  ];
  if(o.reverse)header.reverse();
  const x=[250,570,900];
  function block(y,secondYtd){
    header.forEach((c,i)=>{
      if(o.splitHeader===c.role){
        out+=cell('Kertymä',x[i],y);
        out+=cell(c.label.slice('Kertymä '.length),x[i]+65,y);
      } else out+=cell(c.label,x[i],y);
      if(o.duplicateHeader===c.role)out+=cell(c.label,x[i]+105,y);
    });
    if(o.taxableLabel!=='palkka')out+=cell('Ver.al.ans',75,y-50);
    header.forEach((c,i)=>{
      if(c.role==='ytd'&&o.includeYtd===false)return;
      if(o.taxableLabel==='palkka')out+=cell('Ennakonpid.al.tulo',x[i]-140,y-50);
      const text=c.role==='ytd'?secondYtd:c.value;
      const px=x[i]+10+(o.offsets?.[c.role]??0);
      if(o.splitValue===c.role){
        out+=cell(text.slice(0,2),px,y-50);
        out+=cell(text.slice(2),px+20,y-50);
      } else out+=cell(text,px,y-50);
    });
    if(o.extraMoney)out+=cell('99 999,00',1100,y-50);
    if(o.unanchoredMoney)out+=cell('99 999,00',580,y-88);
  }
  block(660,ytd);
  if(o.secondBlock!=null)block(390,o.secondBlock);
  return out;
}
export function syntheticPayrollPdf(pageOptions=[{}]){
  if(!Array.isArray(pageOptions)||!pageOptions.length||pageOptions.length>5)throw new Error('Invalid fixture page count');
  const objects=[];
  const add=x=>(objects.push(x),objects.length);
  const catalog=add(''),pages=add('');
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids=[];
  for(const options of pageOptions){
    const content=pageContent(options);
    const data=add('<< /Length '+bytes(content).length+' >>\nstream\n'+content+'endstream');
    const rotation=options.rotate?' /Rotate '+options.rotate:'';
    const crop=options.crop?' /CropBox [75 0 1125 840]':'';
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
