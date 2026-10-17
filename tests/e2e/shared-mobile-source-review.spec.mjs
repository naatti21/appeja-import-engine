import {test,expect} from '@playwright/test';

const path='/demo/mobile-source-review.html',STORAGE_KEY='existing-user-portfolio';
async function prepare(page,width=360){
  await page.setViewportSize({width,height:780});
  await page.addInitScript(key=>localStorage.setItem(key,'KEEP_ME'),STORAGE_KEY);
  await page.goto(path);
}
const storage=page=>page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
const documentHeight=page=>page.evaluate(()=>document.documentElement.scrollHeight);
async function openField(page,key,index=0){
 const card=page.locator('.review-card').nth(index);
 await card.locator('.record-details > summary').click();
 return card.locator('.compact-field[data-field="'+key+'"]');
}
async function syntheticPng(page){
 return page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=190;
   const x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,400,190);
   x.fillStyle='#111';x.font='24px Arial';x.fillText('SYNTHETIC HOLDING 7',12,45);
   return canvas.toDataURL('image/png').split(',')[1];
 });
}
test('320px holdings: compact two-card summary, source and correction only on demand',async({page})=>{
 await prepare(page,320);
 await page.locator('#sampleHoldings').click();
 await expect(page.locator('.review-card')).toHaveCount(2);
 await expect(page.locator('#draftSummary')).toContainText('Omistuksia 2');
 await expect(page.locator('.summary-grid')).toHaveCount(2);
 await expect(page.locator('input.edit-input')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Vahvista Kappalemäärä/i})).toHaveCount(0);
 await expect(page.locator('#reviewCards')).toContainText('Aurora Robotics');
 await expect(page.locator('#reviewCards')).toContainText('Boreal Materials');
 const compactHeight=await documentHeight(page);
 console.log('COMPACT_MOBILE_HOLDINGS_HEIGHT '+JSON.stringify({width:320,height:compactHeight}));
 expect(compactHeight).toBeLessThan(1850);
 const q=await openField(page,'quantity');
 await q.locator('.evidence-toggle summary').click();
 await expect(q).toContainText('Rivi 2, sarake 2');
 await expect(q).toContainText('7');
 await q.getByRole('button',{name:'Korjaa Kappalemäärä'}).click();
 const input=q.getByRole('textbox',{name:'Kappalemäärä uusi arvo'});
 await input.fill('9');
 await q.getByRole('button',{name:'Vahvista Kappalemäärä'}).click();
 await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
 await expect(page.locator('input.edit-input')).toHaveCount(0);
 const q2=await openField(page,'quantity');
 await expect(q2).toContainText('Korjattu käsin');
 await expect(q2).toContainText('9');
 await expect(page.locator('#reviewCards')).toContainText('Aurora Robotics');
 expect(await storage(page)).toBe('KEEP_ME');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
 await page.locator('#cancel').click();
 await expect(page.locator('#draftPanel')).toBeHidden();
 await expect(page.locator('.review-card')).toHaveCount(0);
 expect(await storage(page)).toBe('KEEP_ME');
});
test('393px payroll: single summary, no default inputs, source-linked correction',async({page})=>{
 await prepare(page,393);
 await page.locator('#samplePayroll').click();
 await expect(page.locator('.review-card')).toHaveCount(1);
 await expect(page.locator('input.edit-input')).toHaveCount(0);
 await expect(page.locator('.summary-grid')).toContainText('2026-10-17');
 await expect(page.locator('.summary-grid')).toContainText('Bruttopalkka');
 await expect(page.locator('.summary-grid')).toContainText('Nettopalkka');
 const compactHeight=await documentHeight(page);
 console.log('COMPACT_MOBILE_PAYROLL_HEIGHT '+JSON.stringify({width:393,height:compactHeight}));
 expect(compactHeight).toBeLessThan(1850);
 const gross=await openField(page,'grossPay');
 await gross.locator('.evidence-toggle summary').click();
 await expect(gross).toContainText('PDF, sivu 1');
 await gross.getByRole('button',{name:'Korjaa Bruttopalkka'}).click();
 await gross.getByRole('textbox',{name:'Bruttopalkka uusi arvo'}).fill('3300,00');
 await gross.getByRole('button',{name:'Vahvista Bruttopalkka'}).click();
 await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
 expect(await storage(page)).toBe('KEEP_ME');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
});
test('uploaded CSV: HTML stays inert and blank edits cannot be confirmed',async({page})=>{
 await prepare(page);
 const source='Name;Quantity;Buy Price;Currency\n"<img src=x onerror=alert(1)>";4;7,50;EUR';
 await page.locator('#documentFile').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(source)});
 await page.locator('#analyze').click();
 await expect(page.locator('.review-card')).toHaveCount(1);
 await expect(page.locator('#reviewCards')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('#reviewCards img')).toHaveCount(0);
 const price=await openField(page,'buyPrice');
 await price.getByRole('button',{name:'Korjaa Hankintahinta'}).click();
 await expect(price.getByRole('textbox',{name:'Hankintahinta uusi arvo'})).toHaveValue('7.5');
 await price.getByRole('textbox',{name:'Hankintahinta uusi arvo'}).fill('');
 await price.getByRole('button',{name:'Vahvista Hankintahinta'}).click();
 await expect(page.getByRole('status')).toContainText('Korjaus epäonnistui');
 await expect(page.locator('#draftSummary')).toContainText('0 korjausta');
});
test('OCR without a verified table: ONE summary, no guessed holdings and no edit forms',async({page,context})=>{
 const outside=[];
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(!['localhost','127.0.0.1'].includes(url.hostname)){
     outside.push(url.href);return route.abort();
   }
   return route.continue();
 });
 await page.addInitScript(()=>{
   const head='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
   const row='5\t1\t1\t1\t1\t1\t12\t20\t145\t25\t94\tSYNTHETIC';
   const row2='5\t1\t1\t1\t1\t2\t180\t20\t30\t25\t94\t7';
   window.Tesseract={createWorker:async()=>({
     recognize:async()=>({data:{tsv:[head,row,row2].join('\n'),text:'SYNTHETIC 7'}}),
     terminate:async()=>{}
   })};
 });
 await prepare(page);
 const png=await syntheticPng(page);
 await page.locator('#documentFile').setInputFiles({
   name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')
 });
 await page.locator('#analyze').click();
 await expect(page.locator('#draftPanel')).toBeVisible();
 await expect(page.locator('.review-card')).toHaveCount(0);
 await expect(page.locator('#reviewCards')).toContainText('Salkkua ei voitu tunnistaa');
 await expect(page.locator('#reviewCards')).not.toContainText('Kappalemäärä');
 await expect(page.locator('input.edit-input')).toHaveCount(0);
 await expect(page.locator('#sourcePreview')).toBeVisible();
 await page.getByText(/Näytä luettu teksti/).click();
 await expect(page.locator('#reviewCards')).toContainText('SYNTHETIC 7');
 expect(outside).toEqual([]);
 await page.locator('#cancel').click();
 expect(await page.locator('#sourcePreview').getAttribute('src')).toBe(null);
 expect(await storage(page)).toBe('KEEP_ME');
});
test('cancel while OCR unresolved prevents discarded session from resurfacing',async({page})=>{
 await page.addInitScript(()=>{
   const head='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
   window.Tesseract={createWorker:async()=>({
     recognize:async()=>{
       window.waitStarted=true;
       await new Promise(resolve=>window.releaseReview=resolve);
       return {data:{tsv:[head,'5\t1\t1\t1\t1\t1\t12\t20\t100\t25\t90\tTEST'].join('\n'),text:'TEST'}};
     },
     terminate:async()=>{}
   })};
 });
 await prepare(page);
 const png=await syntheticPng(page);
 await page.locator('#documentFile').setInputFiles({
   name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')
 });
 await page.locator('#analyze').click();
 await expect.poll(()=>page.evaluate(()=>window.waitStarted===true)).toBe(true);
 await page.locator('#cancel').click();
 await page.evaluate(()=>window.releaseReview());
 await page.waitForTimeout(120);
 await expect(page.locator('#draftPanel')).toBeHidden();
 await expect(page.locator('.review-card')).toHaveCount(0);
 expect(await storage(page)).toBe('KEEP_ME');
});
test('invalid input stays blocked and refresh forgets every correction',async({page})=>{
 await prepare(page);
 await page.locator('#kind').selectOption('payroll');
 await page.locator('#documentFile').setInputFiles({
   name:'wrong.csv',mimeType:'text/csv',buffer:Buffer.from('Name;Qty\nX;4')
 });
 await page.locator('#analyze').click();
 await expect(page.getByRole('status')).toContainText('vain tekstipohjaisen PDF:n');
 await expect(page.locator('#draftPanel')).toBeHidden();
 await page.locator('#sampleHoldings').click();
 const q=await openField(page,'quantity');
 await q.getByRole('button',{name:'Korjaa Kappalemäärä'}).click();
 await q.getByRole('textbox',{name:'Kappalemäärä uusi arvo'}).fill('30');
 await q.getByRole('button',{name:'Vahvista Kappalemäärä'}).click();
 await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
 await page.reload();
 await expect(page.locator('#draftPanel')).toBeHidden();
 await expect(page.getByRole('status')).toContainText('Valitse esimerkki');
 expect(await storage(page)).toBe('KEEP_ME');
});
test('10 holdings start with only four summary cards and expand on demand',async({page})=>{
 await prepare(page,360);
 const rows=Array.from({length:10},(_,i)=>'Imaginary Company '+(i+1)+';'+(i+2)+';12,50;EUR');
 const csv=['Name;Quantity;Buy Price;Currency',...rows].join('\n');
 await page.locator('#documentFile').setInputFiles({
   name:'ten-synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)
 });
 await page.locator('#analyze').click();
 await expect(page.locator('#draftSummary')).toContainText('Omistuksia 10');
 await expect(page.locator('.review-card')).toHaveCount(4);
 await expect(page.locator('input.edit-input')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Näytä loput 6 omistusta'})).toBeVisible();
 await page.getByRole('button',{name:'Näytä loput 6 omistusta'}).click();
 await expect(page.locator('.review-card')).toHaveCount(10);
});
