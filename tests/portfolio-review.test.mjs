import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPortfolioViews} from '../src/portfolio-review.mjs';

// Fictitious accounts, instruments and figures. NOT derived user financial values.
const scalar=(raw,id)=>({raw,sourceIds:[id]});
const position=(key,quantity,marketValue,{latestPrice=null,averageCost=null,assetClass='equity'}={})=>{
 const prefix=key.toLowerCase();
 return {key,assetClass,
  quantity:scalar(quantity,prefix+'-qty'),
  marketValue:scalar(marketValue,prefix+'-value'),
  ...(latestPrice?{latestPrice:scalar(latestPrice,prefix+'-latest')}:{ }),
  ...(averageCost?{averageCost:scalar(averageCost,prefix+'-cost')}:{})};
};
function view(sourceId,accountKey,holdings,{total=null,cash=null}={}){
 const observ=[];
 for(const h of holdings)for(const field of ['quantity','marketValue','latestPrice','averageCost']){
  for(const id of h[field]?.sourceIds??[])observ.push({id,raw:h[field].raw});
 }
 if(total)observ.push({id:'sum',raw:total});
 if(cash)observ.push({id:'cash',raw:cash});
 return {sourceId,accountKey,observations:observ,holdings,
  ...(total?{total:scalar(total,'sum')}:{ }),
  ...(cash?{cash:scalar(cash,'cash')}:{ })};
}
const codeIn=(r,code)=>r.problems.some(p=>p.code===code);
test('market value and quantity cannot substitute for missing purchase cost',()=>{
 const p=position('SYNTH-EQ-A','5 kpl','125,00 EUR');
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[p],{cash:'5,00 EUR',total:'130,00 EUR'})]);
 assert.equal(r.positions.length,1);
 assert.equal(r.positions[0].buyPrice,null);
 assert.equal(r.positions[0].marketValue.value,125);
 assert.ok(codeIn(r,'PURCHASE_PRICE_NOT_SHOWN'));
 assert.ok(!codeIn(r,'ACCOUNT_TOTAL_RECONCILIATION_FAILED'));
 assert.equal(r.canPersist,false);
});
test('replayed summary and detail of same asset cannot create three holdings',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR');
 const b=position('SYNTH-FUND-B','2,5 kpl','75,00 EUR',{assetClass:'fund'});
 const summary=view('A1','ACCOUNT-ONE',[a,b],{cash:'5,00 EUR',total:'205,00 EUR'});
 const replay=view('A2','ACCOUNT-ONE',[a,b],{cash:'5,00 EUR',total:'205,00 EUR'});
 const details=view('A3','ACCOUNT-ONE',[b]);
 const r=reviewPortfolioViews([summary,replay,details]);
 assert.equal(r.accounts[0].positionCount,2);
 assert.equal(r.duplicatePositions,3);
 assert.equal(r.duplicateViews,2);
 assert.equal(r.positions.find(x=>x.key==='SYNTH-FUND-B').sourceIds.length,3);
 assert.ok(codeIn(r,'PURCHASE_PRICE_NOT_SHOWN'));
 assert.equal(r.canPersist,false);
});
test('same asset in two separate accounts is never merged',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a]),view('B1','ACCOUNT-TWO',[a])]);
 assert.equal(r.positions.length,2);
 assert.equal(r.accounts.length,2);
 assert.equal(r.duplicatePositions,0);
});
test('explicit latest and average cost stay distinct, buying price is not current quote',()=>{
 const a=position('SYNTH-EQ-A','10 kpl','99,00 EUR',
  {latestPrice:'9,90 EUR',averageCost:'12,50 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a])]);
 assert.equal(r.positions[0].latestPrice.value,9.9);
 assert.equal(r.positions[0].buyPrice.value,12.5);
 assert.ok(!codeIn(r,'PURCHASE_PRICE_NOT_SHOWN'));
 assert.ok(!codeIn(r,'MARKET_PRICE_RECONCILIATION_FAILED'));
 assert.equal(r.status,'candidate-only');
 assert.equal(r.canPersist,false);
});
test('OCR-style comma loss (9,90 => 990) must block through market total check',()=>{
 const a=position('SYNTH-EQ-A','10 kpl','99,00 EUR',
  {latestPrice:'990 EUR',averageCost:'12,50 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a])]);
 assert.ok(codeIn(r,'MARKET_PRICE_RECONCILIATION_FAILED'));
 assert.equal(r.status,'review-required');
});
test('conflicting values from two views are preserved as review issue',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const b=position('SYNTH-EQ-A','5 kpl','127,00 EUR',{averageCost:'20,00 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a]),view('A2','ACCOUNT-ONE',[b])]);
 assert.ok(codeIn(r,'CONFLICTING_POSITION_VIEWS'));
 assert.equal(r.positions.length,1);
});
test('fund detail may enrich missing average price without making a second holding',()=>{
 const a=position('SYNTH-FUND-B','2,5 kpl','75,00 EUR',{assetClass:'fund'});
 const b=position('SYNTH-FUND-B','2,5 kpl','75,00 EUR',
  {assetClass:'fund',averageCost:'23,50 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a]),view('A2','ACCOUNT-ONE',[b])]);
 assert.equal(r.positions.length,1);
 assert.equal(r.positions[0].buyPrice.value,23.5);
 assert.ok(!codeIn(r,'PURCHASE_PRICE_NOT_SHOWN'));
});
test('portfolio total is not an extra asset, inconsistent totals are blocked',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a],
  {cash:'5,00 EUR',total:'150,00 EUR'})]);
 assert.equal(r.positions.length,1);
 assert.ok(codeIn(r,'ACCOUNT_TOTAL_RECONCILIATION_FAILED'));
});
test('money in different currencies must not be silently combined',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 USD',{averageCost:'20,00 USD'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a],
  {cash:'5,00 EUR',total:'130,00 EUR'})]);
 assert.ok(codeIn(r,'ACCOUNT_TOTAL_CURRENCY_MISMATCH'));
});
test('account label is required before merging any holding',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const r=reviewPortfolioViews([view('A1','',[a])]);
 assert.ok(codeIn(r,'ACCOUNT_NOT_VERIFIED'));
 assert.equal(r.positions.length,0);
});
test('missing or forged source reference cannot be verified',()=>{
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const v=view('A1','ACCOUNT-ONE',[a]);
 v.observations=v.observations.filter(x=>x.id!=='synth-eq-a-cost');
 const r=reviewPortfolioViews([v]);
 assert.ok(codeIn(r,'UNVERIFIABLE_SOURCE_IDS'));
});
test('unreadable quantity is review-only, never 0 by default',()=>{
 const a=position('SYNTH-EQ-A','5? kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const r=reviewPortfolioViews([view('A1','ACCOUNT-ONE',[a])]);
 assert.ok(codeIn(r,'INVALID_NUMBER_OR_UNIT'));
 assert.ok(codeIn(r,'REQUIRED_HOLDING_MISSING'));
 assert.equal(r.positions.length,0);
});
test('no views or duplicate source ID are invalid, canPersist always false',()=>{
 assert.equal(reviewPortfolioViews([]).canPersist,false);
 const a=position('SYNTH-EQ-A','5 kpl','125,00 EUR',{averageCost:'20,00 EUR'});
 const v=view('A1','ACCOUNT-ONE',[a]);
 const r=reviewPortfolioViews([v,v]);
 assert.ok(codeIn(r,'INVALID_OR_DUPLICATE_VIEW_ID'));
 assert.equal(r.canPersist,false);
});
