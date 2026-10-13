import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {completePayslipPdf} from '../demo/complete-pdf.mjs';

for(const name of ['a-modern','b-compact','c-alt-terms']){
 test('complete synthetic '+name+' builds native WinAnsi PDF bytes',async()=>{
  const source=await readFile(new URL('./fixtures/complete-payslips/'+name+'.txt',import.meta.url),'utf8');
  const pdf=completePayslipPdf(source);
  assert.equal(new TextDecoder('ascii').decode(pdf.slice(0,8)),'%PDF-1.4');
  assert.ok(pdf.byteLength>1000);
  assert.match(new TextDecoder('latin1').decode(pdf),/\/Type \/Page/);
  assert.match(new TextDecoder('latin1').decode(pdf),/xref/);
 });
}
test('PDF builder refuses unknown unicode and oversize synthetic source',()=>{
 assert.throws(()=>completePayslipPdf('🙂'),/Unsupported synthetic fixture character/);
 assert.throws(()=>completePayslipPdf(Array.from({length:45},()=> 'abc').join('\n')),/too many lines/);
});
