import {test,expect} from '@playwright/test';
import {syntheticHoldingsXlsx} from '../fixtures/native-xlsx.mjs';
import {completePayslipPdf} from '../../demo/complete-pdf.mjs';
import {readFile} from 'node:fs/promises';
const path='/demo/review.html';
async function pick(page,name,mimeType,buffer){
 await page.locator('#sourceFile').setInputFiles({name,mimeType,buffer:Buffer.from(buffer)});
 await page.getByRole('button',{name:'Analysoi tiedosto'}).click();
 await expect(page.getByRole('status')).toContainText('Esitarkistus valmis');
}
test('v1.0 mobile review: CSV import shows holdings, provenance, and no save button',async({page})=>{
 await page.setViewportSize({width:360,height:760});
 await page.goto(path);
 const csv='Ticker,Name,Quantity,Buy Price,Currency\nNOKIA,Nokia,10,3.5,EUR\nMSFT,Microsoft,2,400,USD';
 await pick(page,'fictional.csv','text/csv',Buffer.from(csv));
 await expect(page.locator('#formatText')).toHaveText('CSV/TSV');
 await expect(page.locator('#candidates')).toContainText('NOKIA');
 await expect(page.locator('#candidates')).toContainText('MSFT');
 await expect(page.locator('#candidates')).toContainText('csv-r2-c3');
 await expect(page.locator('#candidates')).toContainText('3.5');
 await expect(page.getByText('Ei tallennusta',{exact:true})).toBeVisible();
 await expect(page.locator('button')).toHaveCount(2);
 await page.screenshot({path:'test-results/v10-mobile-csv.png',fullPage:true});
});
test('v1.0 mobile review: real compressed XLSX shows underlying cells without writing',async({page})=>{
 await page.goto(path);
 await pick(page,'fictional.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  syntheticHoldingsXlsx());
 await expect(page.locator('#formatText')).toHaveText('XLSX');
 await expect(page.locator('#candidates')).toContainText('NOKIA');
 await expect(page.locator('#candidates')).toContainText('MSFT');
 await expect(page.locator('#candidates')).toContainText('xlsx-s1-C2');
 await expect(page.locator('#summary')).toContainText('Salkku');
 await expect(page.locator('#issues')).toContainText('MULTIPLE_SHEETS_REVIEW');
});
test('v1.0 mobile review: native synthetic full payslip PDF shows four core fields and sources',async({page})=>{
 const text=await readFile(new URL('../fixtures/complete-payslips/a-modern.txt',import.meta.url),'utf8');
 await page.goto(path);
 await pick(page,'fictional-salary.pdf','application/pdf',completePayslipPdf(text));
 await expect(page.locator('#formatText')).toHaveText('PDF');
 await expect(page.locator('#candidates')).toContainText('2026-08-28');
 await expect(page.locator('#candidates')).toContainText('4698.11');
 await expect(page.locator('#candidates')).toContainText('2678.39');
 await expect(page.locator('#candidates')).toContainText('63832.82');
 await expect(page.locator('#candidates')).toContainText('pdf-p1-t');
 await expect(page.locator('#issues')).toContainText('UNACCOUNTED_MATERIAL');
});
test('v1.0 mobile review: unrecognized native PDF shows raw evidence only',async({page})=>{
 await page.goto(path);
 await pick(page,'fictional-other.pdf','application/pdf',completePayslipPdf('SYNTHETIC OTHER DOCUMENT\nUnrelated value 123,45'));
 await expect(page.locator('#formatText')).toHaveText('PDF');
 await expect(page.locator('#issues')).toContainText('DOCUMENT_TYPE_NOT_INTERPRETED');
 await expect(page.locator('#candidates')).toContainText('Dokumentin semantiikka ei ole varmennettu');
});
test('v1.0 OCR review shows screenshot evidence with no financial auto-accept',async({page})=>{
 await page.addInitScript(()=>{
  const head='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const body=[
   '5\t1\t1\t1\t1\t1\t12\t20\t80\t22\t92\tSYNTH-FUND',
   '5\t1\t1\t1\t2\t1\t12\t60\t45\t22\t90\t5,5',
   '5\t1\t1\t1\t2\t2\t68\t60\t28\t22\t88\tkpl',
   '5\t1\t1\t1\t2\t3\t160\t60\t95\t22\t86\t123,00',
   '5\t1\t1\t1\t2\t4\t265\t60\t70\t22\t83\tEUR'
  ];
  window.Tesseract={createWorker:async()=>({
   recognize:async()=>({data:{tsv:[head,...body].join('\n'),text:'SYNTH-FUND 5,5 kpl 123,00 EUR'}}),
   terminate:async()=>{}
  })};
 });
 await page.goto(path);
 const dataUrl=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#151515';ctx.fillRect(0,0,400,200);
  ctx.fillStyle='#fff';ctx.font='24px sans-serif';ctx.fillText('SYNTH-FUND',12,38);
  ctx.fillText('5,5 kpl   123,00 EUR',12,78);
  return canvas.toDataURL('image/png');
 });
 await pick(page,'synthetic.png','image/png',Buffer.from(dataUrl.split(',')[1],'base64'));
 await expect(page.locator('#formatText')).toHaveText('Kuva/OCR');
 await expect(page.locator('#preview')).toBeVisible();
 await expect(page.locator('#candidates')).toContainText('SYNTH-FUND');
 await expect(page.locator('#candidates')).toContainText('ei hyväksytty omistus');
 await expect(page.locator('#issues')).toContainText('OCR_DECIMAL_PUNCTUATION_RISK');
 await page.getByRole('button',{name:'Tyhjennä näkymä'}).click();
 await expect(page.locator('#results')).toBeHidden();
});
test('v1.0 rejects HTML-as-CSV injection as visible text, not executed content',async({page})=>{
 await page.goto(path);
 const s='Ticker,Name,Quantity,Buy Price,Currency\nSAFE,"<img src=x onerror=alert(1)>",2,3,EUR';
 await pick(page,'synthetic.csv','text/csv',Buffer.from(s));
 await expect(page.locator('#candidates')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('#candidates img')).toHaveCount(0);
});
