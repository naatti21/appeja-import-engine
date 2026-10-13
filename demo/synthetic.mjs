/** Deliberately fake values and geometry; no user documents. */
import {layoutFromPdfItems} from '../src/layout.mjs';
const PAGE_W=1000, PAGE_H=1200;
function item(text,x,top,width=140,height=19) {
  return {str:text,transform:[11,0,0,11,x,PAGE_H-top-height],width,height};
}
export function payrollPage({ytd='42 000,00',gross='3 200,00',previous='38 000,00',
  includeYtd=true, reverse=false, secondBlock=null, identicalHeader=false, corruptGeo=false}={}) {
  const one=(t0,vals)=>{
    const order= reverse ? [
      ['Kertymä edelliseltä vuodelta','previous',780],
      ['Kertymä vuoden alusta','ytd',550],
      ['Kertymä palkkakaudelta','gross',310]] : [
      ['Kertymä palkkakaudelta','gross',310],
      ['Kertymä vuoden alusta','ytd',550],
      ['Kertymä edelliseltä vuodelta','previous',780]
    ];
    const head=order.map(([label,,x])=>item(label,x,t0,200));
    const data=[item('Ver.al.ans',75,t0+42,180),
      ...order.filter(([,role])=>role!=='ytd' || includeYtd).map(([,role,x])=>item(vals[role],x+6,t0+42,135))];
    return [...head,...data];
  };
  const arr=one(200,{gross,ytd,previous});
  if(secondBlock!==null)arr.push(...one(720,{gross,ytd:secondBlock,previous}));
  if(identicalHeader) arr.push(item('Kertymä vuoden alusta',560,200,185));
  if(corruptGeo) arr[3].transform=[0,11,-11,0,320,900];
  return {width:PAGE_W,height:PAGE_H,items:arr};
}
export function payLayout(pages){return layoutFromPdfItems(pages.map(p=>payrollPage(p)));}
