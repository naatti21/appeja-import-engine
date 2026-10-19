import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issue55Fixture} from './fixtures/issue55-name-role.mjs';
import {extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';
import {preparePortfolioIdentityReview,chooseInstrumentIdentity}
  from '../src/portfolio-identity-review.mjs';

for(const mode of ['clean','faint','absent']){
  test('issue55 identity gate refuses automatically trusted OCR names: '+mode,()=>{
    const f=issue55Fixture({mode});
    const before=structuredClone(f.source);
    const observed=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
    const reviewed=preparePortfolioIdentityReview(observed,f.source);
    assert.deepEqual(f.source,before);
    assert.equal(reviewed.rows.length,3);
    assert.deepEqual(reviewed.candidates,[],'unverified OCR names must not become security claims');
    assert.equal(reviewed.userSelections.length,0);
    assert.equal(reviewed.marketIdentityVerified,false);
    assert.equal(reviewed.canPersist,false);
    assert.equal(reviewed.observedArithmetic,'pass','visible amount sum is kept only as observation');
    assert.equal(reviewed.reconciliation.status,'not-evaluable',
      'arithmetic pass cannot imply identity proof');
    assert.equal(reviewed.unresolved.filter(x=>x.reason==='UNPROVEN_SEMANTIC_NAME_ROLE').length,3);
    assert.ok(reviewed.rows.every(r=>r.observedTextRole==='UNPROVEN_NAME_OR_HEADING'));
    assert.ok(reviewed.rows.every(r=>r.sourceIds.name.length&&r.sourceIds.quantity.length));
    const wrongOCR=mode==='clean'?null:'Growth bucket';
    assert.equal(reviewed.rows[0].observedText,wrongOCR??'Amber Circuit');
    assert.equal(reviewed.candidates.some(c=>c.fields?.name?.value==='Growth bucket'),false);
    console.log('ISSUE55_GATE '+JSON.stringify({
      mode,rawNames:observed.candidates.map(c=>c.fields.name.value),
      untrustedRows:reviewed.rows.length,automaticVerified:reviewed.candidates.length,
      pending:reviewed.rows.length-reviewed.userSelections.length,
      arithmeticObservation:reviewed.observedArithmetic,
      trustedReconciliation:reviewed.reconciliation.status
    }));
  });
}
test('issue55 one explicit decision at a time, corrected name is USER claim not OCR evidence',()=>{
  const f=issue55Fixture({mode:'absent'});
  const raw=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
  const review=preparePortfolioIdentityReview(raw,f.source);
  const [a,b,c]=review.rows;
  assert.equal(chooseInstrumentIdentity(review,{rowId:'not-an-existing-row',decision:'confirm-observed'}).status,'rejected');
  assert.equal(chooseInstrumentIdentity(review,{rowId:a.rowId,decision:'correct-name',chosenName:'  '}).status,'rejected');
  const r1=chooseInstrumentIdentity(review,{rowId:a.rowId,decision:'correct-name',chosenName:'Amber Circuit'});
  assert.equal(r1.userSelections[0].observedText,'Growth bucket');
  assert.equal(r1.userSelections[0].userSelectedName,'Amber Circuit');
  assert.equal(r1.userSelections[0].assertionSource,'explicit-user-choice');
  assert.equal(r1.remainingReviewRows,2);
  assert.equal(chooseInstrumentIdentity(r1,{rowId:a.rowId,decision:'confirm-observed'}).status,'rejected');
  const r2=chooseInstrumentIdentity(r1,{rowId:b.rowId,decision:'confirm-observed'});
  const r3=chooseInstrumentIdentity(r2,{rowId:c.rowId,decision:'confirm-observed'});
  assert.equal(r3.remainingReviewRows,0);
  assert.equal(r3.userSelections.length,3);
  assert.deepEqual(r3.candidates,[]);
  assert.equal(r3.marketIdentityVerified,false);
  assert.equal(r3.canPersist,false);
  assert.equal(r3.reconciliation.status,'not-evaluable');
  assert.equal(review.userSelections.length,0,'previous immutable review state unchanged');
});
test('issue55 missing or forged source ownership is rejected without lookup',()=>{
  const f=issue55Fixture();
  const raw=extractVisualPortfolioCorroborated(f.source,structuredClone(f.source));
  const forged=structuredClone(raw);
  forged.candidates[0].fields.name.sourceIds=['MISSING-SOURCE-ID'];
  const reviewed=preparePortfolioIdentityReview(forged,f.source);
  assert.equal(reviewed.rows.length,2);
  assert.deepEqual(reviewed.candidates,[]);
  assert.ok(reviewed.unresolved.some(u=>u.reason==='INVALID_IDENTITY_REVIEW_ROW'));
  assert.equal(reviewed.canPersist,false);
  const bad=preparePortfolioIdentityReview(raw,{...f.source,observations:[
    f.source.observations[0],f.source.observations[0],...f.source.observations.slice(1)]});
  assert.equal(bad.rows.length,0);
  assert.equal(bad.canPersist,false);
  assert.deepEqual(bad.candidates,[]);
});
