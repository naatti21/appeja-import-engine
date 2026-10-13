import {test,expect} from '@playwright/test';

// Entirely synthetic views: NO captured financial screenshots or user values.
test('v0.9 screenshot review: market value is not buying price',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async()=>{
  const {reviewPortfolioViews}=await import('/src/portfolio-review.mjs');
  const q={raw:'4 kpl',sourceIds:['q']},v={raw:'40,00 EUR',sourceIds:['v']};
  return reviewPortfolioViews([{sourceId:'SRC-A',accountKey:'DEMO-ACCOUNT',
   observations:[{id:'q',raw:q.raw},{id:'v',raw:v.raw}],
   holdings:[{key:'DEMO-EQUITY',assetClass:'equity',quantity:q,marketValue:v}]}]);
 });
 expect(result.positions).toHaveLength(1);
 expect(result.positions[0].buyPrice).toBe(null);
 expect(result.problems.some(p=>p.code==='PURCHASE_PRICE_NOT_SHOWN')).toBe(true);
 expect(result.canPersist).toBe(false);
});
test('v0.9 screenshot review: corrupted OCR current price is blocked in browser',async({page})=>{
 await page.goto('/demo/');
 const result=await page.evaluate(async()=>{
  const {reviewPortfolioViews}=await import('/src/portfolio-review.mjs');
  const fields={
   quantity:{raw:'4 kpl',sourceIds:['q']},
   marketValue:{raw:'40,00 EUR',sourceIds:['v']},
   latestPrice:{raw:'1000 EUR',sourceIds:['p']},
   averageCost:{raw:'8,00 EUR',sourceIds:['c']}
  };
  return reviewPortfolioViews([{sourceId:'SRC-A',accountKey:'DEMO-ACCOUNT',
   observations:Object.entries(fields).map(([k,f])=>({id:f.sourceIds[0],raw:f.raw})),
   holdings:[{key:'DEMO-EQUITY',assetClass:'equity',...fields}]}]);
 });
 expect(result.problems.map(p=>p.code)).toContain('MARKET_PRICE_RECONCILIATION_FAILED');
 expect(result.canPersist).toBe(false);
});
