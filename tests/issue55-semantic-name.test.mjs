import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issue55Fixture} from './fixtures/issue55-name-role.mjs';
import {extractVisualPortfolioCorroborated} from '../src/portfolio-visual-evidence.mjs';

for(const mode of ['clean','faint','absent']) {
  test('issue55 RED source-level semantic-role oracle: '+mode,()=>{
    const fixture=issue55Fixture({mode}),original=structuredClone(fixture.source);
    const result=extractVisualPortfolioCorroborated(fixture.source,structuredClone(fixture.source));
    const correct=result.candidates.filter(c=>fixture.oracle.some(o=>
      c.fields.name.value===o.name &&
      c.fields.quantity.value===o.quantity &&
      c.fields.marketValue.value?.cents===o.cents)).length;
    const wrong=result.candidates.length-correct,withheld=fixture.oracle.length-correct;
    console.log('ISSUE55_NODE '+JSON.stringify({
      mode,correct,wrong,withheld,reviewBurden:result.unresolved.length,
      names:result.candidates.map(c=>c.fields.name.value),
      reconciliation:result.reconciliation.status
    }));
    assert.deepEqual(fixture.source,original,'reader must not rewrite source evidence');
    assert.equal(result.canPersist,false,'no import/write authorization');
    assert.equal(wrong,0,'a heading must NEVER become a security candidate');
    assert.equal(correct,mode==='clean'?3:2,'preserve clean holdings without guessing missing issuer');
    assert.equal(result.reconciliation.status,mode==='clean'?'pass':'not-evaluable');
    if(mode!=='clean') {
      assert.ok(!result.candidates.some(c=>c.fields.name.value==='Growth bucket'));
      assert.ok(result.unresolved.some(u=>u.field==='name'&&u.sourceIds?.length),
        'only affected instrument needs source-linked, actionable review');
    }
  });
}
