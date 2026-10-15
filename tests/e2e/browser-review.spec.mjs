import '../../research/browser-review-v1/stage-pdf.mjs';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {syntheticPayrollPdf} from '../../demo/native-pdf.mjs';
const root='/research/browser-review-v1/';
const csv='Name;Quantity;Buy Price;Currency;Account\n\nSYNTH-A;8;12,50;EUR;SYN-1\nSYNTH-A;3;;EUR;SYN-2';
async function upload(page,name,buffer,mimeType='text/csv'){
 await page.locator('#sourceFile').setInputFiles({name,mimeType,buffer:Buffer.from(buffer)});
 await page.getByRole('button',{name:'Tutki valittu tiedosto',exact:true}).click();
 await expect(page.locator('#status')).not.toContainText('Lähdettä luetaan');
}
async function probe(page,kind){await page.getByText('Valmiit fiktiiviset kokeet',{exact:true}).click();await page.locator('#probe').selectOption(kind);await page.locator('#probeExample').click();await expect(page.locator('#results')).toBeVisible();}
async function shot(page,name){mkdirSync('test-results/y12-screenshots',{recursive:true});await page.screenshot({path:`test-results/y12-screenshots/${name}.jpg`,type:'jpeg',quality:85});}

test.describe('Y12 read-only browser review',()=>{
 test.beforeEach(async({page})=>{page.on('pageerror',e=>console.error('Y12_UNCAUGHT',e.message));await page.goto(root);});
 test('CSV file, distinct accounts, source lines, draft warning, revert and no persistence',async({page})=>{
  const uploads=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());});
  await upload(page,'synthetic.csv',csv);
  await expect(page.locator('#summary')).toContainText('CSV');
  await expect(page.locator('#notes')).toContainText('Vähintään yhdeltä sijoitusriviltä puuttuu tieto');
  await expect(page.locator('#notes')).not.toContainText('AT_LEAST_ONE_UNVERIFIED_RECORD');
  await expect(page.locator('#fields')).toContainText('SYN-1');await expect(page.locator('#fields')).toContainText('SYN-2');
  await expect(page.locator('[data-field="row2:buyPrice"] [data-claim-state]')).toContainText('vaatii tarkistuksen');
  const card=page.locator('[data-field="row1:quantity"]');
  await expect(card.locator('[data-claim-state]')).toContainText('Lähdeteksti täsmää');
  await card.getByRole('button',{name:'Näytä kentän lähde'}).click();
  await expect(page.locator('#sourceText')).toContainText('CSV lähderivi 3, solu R2C2');
  await expect(page.locator('#sourceText')).toContainText('"raw": "8"');
  await card.getByLabel('Määrä · luonnosarvo',{exact:true}).fill('800');await card.getByRole('button',{name:'Tarkista luonnos'}).click();
  await expect(card.locator('[data-claim-state]')).toContainText('vaatii tarkistuksen');
  await expect(card).toContainText('Alkuperäinen ehdotus: 8');await expect(card).toContainText('Oma luonnosehdotus');
  await card.getByRole('button',{name:'Palauta alkuperäinen'}).click();await expect(card.getByLabel('Määrä · luonnosarvo',{exact:true})).toHaveValue('8');
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});expect(uploads).toEqual([]);
  await page.locator('#clear').click();await expect(page.locator('#results')).toBeHidden();await page.reload();await expect(page.locator('#results')).toBeHidden();
 });
 test('actual payroll PDF file, proposals and original page/box preview',async({page})=>{
  await upload(page,'synthetic-payroll.pdf',syntheticPayrollPdf([{fullSlip:true}]),'application/pdf');
  await expect(page.locator('#summary')).toContainText('PDF');await expect(page.locator('#fields')).toContainText('Bruttotulo');
  await expect(page.locator('[data-field="grossPay"]')).toContainText('Alkuperäinen ehdotus: 3200');
  await expect(page.locator('[data-field="ytdTaxableIncome"]')).toContainText('Alkuperäinen ehdotus: 42000');
  const field=page.locator('[data-field="grossPay"]');await field.getByRole('button',{name:'Näytä kentän lähde'}).click();
  await expect(page.locator('#sourceText')).toContainText('Sivu 1');await expect(page.locator('#sourceText')).toContainText('"box": {');await expect(page.locator('#preview')).toBeVisible();
  await page.locator('#sourceDetails').scrollIntoViewIfNeeded();await shot(page,'payroll-source-desktop');
  await page.locator('#clear').click();await expect(page.locator('#results')).toBeHidden();
  await upload(page,'after-pdf.csv',csv);await expect(page.locator('#summary')).toContainText('CSV');
 });
 test('local heading split is explicit and revertible, not source rewriting',async({page})=>{
  await probe(page,'heading');const field=page.locator('[data-field="payDate"]');
  await expect(field.locator('[data-claim-state]')).toContainText('vaatii tarkistuksen');
  await field.getByText('Lähderoolien tarkistus',{exact:true}).click();
  await field.getByLabel('Arvolähteiden ID:t',{exact:true}).fill('date');await field.getByLabel('Otsikkolähteiden ID:t',{exact:true}).fill('head');
  await field.getByRole('button',{name:'Tarkista luonnos'}).click();await expect(field.locator('[data-claim-state]')).toContainText('Lähdeteksti täsmää');
  await expect(field).toContainText('Alkuperäiset lähteet: date, head');await field.getByRole('button',{name:'Palauta alkuperäinen'}).click();await expect(field.locator('[data-claim-state]')).toContainText('vaatii tarkistuksen');
 });
 test('global context and distant column remain blocked; metadata alert retained',async({page})=>{
  for(const kind of ['global','column']){await page.reload();await probe(page,kind);await expect(page.locator('[data-field="grossPay"] [data-claim-state]')).toContainText('vaatii tarkistuksen');await expect(page.locator('#warnings')).not.toBeEmpty();}
  await page.reload();await probe(page,'metadata');await expect(page.locator('#notes')).toContainText('edelleen FAIL');await expect(page.locator('#warnings')).toContainText('meta');
 });
 test('malformed, unsupported, empty and oversize files clear stale results visibly',async({page})=>{
  for(const [name,bytes]of [['bad.csv','Name;Quantity\n"unclosed;8'],['bad.txt','not a document'],['empty.csv',''],['big.csv',Buffer.alloc(5*1024*1024+1)]]){
   await upload(page,'good.csv',csv);await expect(page.locator('#results')).toBeVisible();
   await upload(page,name,bytes);await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#results')).toBeHidden();await expect(page.locator('#status')).toContainText('Aiemmat tulokset poistettiin');
  }
 });
 test('rotated/cropped/malformed PDFs fail visibly instead of showing false coordinates',async({page})=>{
  for(const [kind,bytes]of [['rotate',syntheticPayrollPdf([{fullSlip:true,rotate:90}])],['crop',syntheticPayrollPdf([{fullSlip:true,crop:true}])],['corrupt',Buffer.from('not a PDF')]]){
   console.log('Y12_PDF_REJECTION',kind);
   await upload(page,'safe.csv',csv);await expect(page.locator('#results')).toBeVisible();
   await upload(page,'unsupported.pdf',bytes,'application/pdf');await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#results')).toBeHidden();
  }
 });
 test('invalid correction keeps previous proposal and gives actionable error',async({page})=>{
  await upload(page,'good.csv',csv);const field=page.locator('[data-field="row1:quantity"]');await field.getByLabel('Määrä · luonnosarvo',{exact:true}).fill('wrong-number');await field.getByRole('button',{name:'Tarkista luonnos'}).click();
  await expect(page.locator('#error')).toContainText('Luonnosta ei sovellettu');await expect(page.locator('#results')).toBeVisible();await expect(field).toContainText('Alkuperäinen ehdotus: 8');
 });
 test('360/412 CSS pixel emulation: no horizontal overflow and touch targets >=44px',async({page})=>{
  for(const width of [360,412]){await page.setViewportSize({width,height:840});await upload(page,'mobile.csv',csv);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const small=await page.locator('button,input,select,summary').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<44).map(e=>e.id||e.textContent));expect(small).toEqual([]);
   if(width===360){await page.locator('#summary').scrollIntoViewIfNeeded();await shot(page,'mobile-360-summary');}
  }
 });
 test('source pagination discloses totals; imported HTML remains plain text',async({page})=>{
  const attack='<img src=x onerror=alert(1)>';
  await upload(page,'long.csv','Name;Quantity;Currency;Account\n'+Array.from({length:30},(_,i)=>`${i===0?attack:'SYNTH-'+i};8;EUR;SYN-${i%2}`).join('\n'));
  await expect(page.locator('#sourceCount')).toContainText('50 / 124');expect(await page.locator('#sources button').count()).toBe(50);
  await page.locator('#more').click();await expect(page.locator('#sourceCount')).toContainText('100 / 124');
  await page.locator('#more').click();await expect(page.locator('#sourceCount')).toContainText('124 / 124');await expect(page.locator('#more')).toBeHidden();
  await expect(page.locator('#sources')).toContainText(attack);expect(await page.locator('#sources img').count()).toBe(0);
 });
 test('real local pixel OCR: same-origin WASM/model, no upload, evidence coordinates',async({page})=>{
  test.skip(process.env.Y12_REAL_OCR!=='1','Dedicated Y12 job stages pinned local OCR assets');test.setTimeout(150000);
  const unexpected=[],uploads=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4175/'))unexpected.push(r.url());if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());});
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1100;c.height=300;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='40px sans-serif';x.fillText('SYNTHETIC PORTFOLIO',40,70);x.fillText('ALPHA 8 shares 12.50 EUR',40,150);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#sourceFile').setInputFiles({name:'synthetic-portfolio.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#analyze').click();
  await expect(page.locator('#summary')).toContainText('Kuva / oikea OCR',{timeout:120000});await expect(page.locator('#sources')).toContainText('ALPHA');
  await expect(page.locator('#fields')).toContainText('Kenttiä ei ole semanttisesti tunnistettu');await expect(page.locator('#notes')).toContainText('Englannin OCR-malli');
  await page.locator('#sources button').filter({hasText:'ALPHA'}).click();await expect(page.locator('#sourceText')).toContainText('"box": {');await expect(page.locator('#preview')).toBeVisible();
  expect(unexpected).toEqual([]);expect(uploads).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});await page.locator('#sourceDetails').scrollIntoViewIfNeeded();await shot(page,'actual-local-ocr');
 });
});
