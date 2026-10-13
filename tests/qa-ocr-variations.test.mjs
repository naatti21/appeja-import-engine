import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceFromOcrTsv} from '../src/import-observations.mjs';
import {reviewPortfolioViews} from '../src/portfolio-review.mjs';
import {seeded,QA_SEEDS,QA_CASES} from './qa/generator.mjs';

const head='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const money=value=>value.toFixed(2).replace('.',',')+' EUR';
function holdings(qty,price,market,latestRaw){
 const f={
  quantity:{raw:qty+' kpl',sourceIds:['qty']},
  marketValue:{raw:money(market),sourceIds:['value']},
  latestPrice:{raw:latestRaw,sourceIds:['price']},
  averageCost:{raw:money(Math.max(0,price*0.83)),sourceIds:['cost']}
 };
 return {sourceId:'synthetic-review',accountKey:'account-test',
  observations:Object.entries(f).map(([key,v])=>({id:v.sourceIds[0],raw:v.raw})),
  holdings:[{key:'SYNTHETIC-ONLY',assetClass:'equity',...f}]};
}
for(const seed of QA_SEEDS){
 test('QA generated OCR source geometry and decimal corruption seed '+seed,()=>{
  const rng=seeded(seed^0x9e3779b9);
  let valid=0,outliers=0,badGeometry=0;
  for(let i=0;i<QA_CASES;i++){
   const quantity=2+Math.floor(rng()*15),price=+(5+rng()*28).toFixed(2);
   const market=+(quantity*price).toFixed(2);
   const validReview=reviewPortfolioViews([holdings(quantity,price,market,money(price))]);
   assert.equal(validReview.problems.some(x=>x.code==='MARKET_PRICE_RECONCILIATION_FAILED'),false);
   assert.equal(validReview.positions.length,1);
   assert.equal(validReview.canPersist,false);
   valid++;
   // OCR dropped comma: quote increases about 100-fold but market remains original.
   const corrupted=String(Math.round(price*100))+' EUR';
   const invalid=reviewPortfolioViews([holdings(quantity,price,market,corrupted)]);
   assert.ok(invalid.problems.some(x=>x.code==='MARKET_PRICE_RECONCILIATION_FAILED'),
    'decimal loss not detected case='+i+' seed='+seed);
   assert.equal(invalid.canPersist,false);
   outliers++;
   const left=10+Math.floor(rng()*200);
   const tsv=[head,'5\t1\t1\t1\t1\t1\t'+left+'\t32\t65\t22\t93\tSYNTHETIC',
    '5\t1\t1\t1\t1\t2\t270\t32\t22\t22\t80\t'+quantity].join('\n');
   const parsed=evidenceFromOcrTsv(tsv,{imageWidth:420,imageHeight:130});
   assert.equal(parsed.observations.length,2);
   assert.equal(parsed.observations[0].source.box.x0,left/420);
   assert.equal(parsed.requiresReview,true);
   assert.equal(parsed.canPersist,false);
   // Randomly push text outside image bounds and require blocking source issue.
   const malformed=tsv.replace('\t270\t32\t22\t22\t80\t','\t409\t32\t22\t22\t80\t');
   const broken=evidenceFromOcrTsv(malformed,{imageWidth:420,imageHeight:130});
   assert.ok(broken.issues.some(x=>x.code==='INVALID_OCR_GEOMETRY'));
   badGeometry++;
  }
  console.log('QA_ORACLE_OCR '+JSON.stringify({seed,validSourcePairs:valid,
   corruptedPriceBlocked:outliers,badGeometryBlocked:badGeometry}));
 });
}
