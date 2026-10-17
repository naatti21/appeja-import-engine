import {test,expect} from '@playwright/test';

const path='/demo/mobile-source-review.html';
const STORAGE_KEY='existing-user-portfolio';
async function prepare(page,width=360){
  await page.setViewportSize({width,height:780});
  await page.addInitScript(key=>localStorage.setItem(key,'KEEP_ME'),STORAGE_KEY);
  await page.goto(path);
}
const storage=page=>page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
function synthPng(page){
  return page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=190;
    const x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,400,190);
    x.fillStyle='#111';x.font='24px Arial';x.fillText('SYNTHETIC HOLDING 7',12,45);
    return canvas.toDataURL('image/png').split(',')[1];
  });
}

test('mobile 320px: existing CSV adapter gives editable, source-linked holdings without any save path',async({page})=>{
  await prepare(page,320);
  await page.locator('#sampleHoldings').click();
  await expect(page.locator('#reviewCards .card')).toHaveCount(2);
  await expect(page.locator('#reviewCards')).toContainText('Aurora Robotics');
  await expect(page.locator('#reviewCards')).toContainText('Boreal Materials');
  await expect(page.locator('#draftSummary')).toContainText('0 korjausta');
  const qty=page.getByRole('textbox',{name:'Kappalemäärä uusi arvo'}).first();
  await expect(qty).toHaveValue('7');
  await page.locator('.field').filter({hasText:'Kappalemäärä'}).first().locator('summary').click();
  await expect(page.locator('.field').filter({hasText:'Kappalemäärä'}).first()).toContainText('Taulukko · rivi 2 · sarake 2');
  await expect(page.locator('.field').filter({hasText:'Kappalemäärä'}).first()).toContainText('7');
  await qty.fill('9');
  await page.getByRole('button',{name:'Vahvista Kappalemäärä'}).first().click();
  await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
  await expect(page.locator('#reviewCards')).toContainText('Korjattu käsin');
  await expect(page.locator('#reviewCards')).toContainText('9');
  await expect(page.getByText('Tallennus on estetty.')).toBeVisible();
  await expect(page.getByRole('button',{name:/tallenna/i})).toHaveCount(0);
  expect(await storage(page)).toBe('KEEP_ME');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.locator('#cancel').click();
  await expect(page.locator('#draftPanel')).toBeHidden();
  await expect(page.locator('#reviewCards .card')).toHaveCount(0);
  expect(await storage(page)).toBe('KEEP_ME');
});

test('mobile 393px: genuine local PDF.js and payroll parser yield corrections with original sources',async({page})=>{
  await prepare(page,393);
  await page.locator('#samplePayroll').click();
  await expect(page.locator('#draftPanel')).toBeVisible();
  await expect(page.locator('#reviewCards')).toContainText('Maksupäivä');
  await expect(page.locator('#reviewCards')).toContainText('2026-10-17');
  await expect(page.locator('#reviewCards')).toContainText('Bruttopalkka');
  await expect(page.locator('#reviewCards')).toContainText('Nettopalkka');
  const gross=page.getByRole('textbox',{name:'Bruttopalkka uusi arvo'});
  await gross.fill('3300,00');
  await page.getByRole('button',{name:'Vahvista Bruttopalkka'}).click();
  await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
  await page.locator('.field').filter({hasText:'Bruttopalkka'}).first().locator('summary').click();
  await expect(page.locator('.field').filter({hasText:'Bruttopalkka'}).first()).toContainText('PDF · sivu 1');
  expect(await storage(page)).toBe('KEEP_ME');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
});

test('an actual uploaded CSV is parsed; unsafe HTML is only inert text',async({page})=>{
  await prepare(page);
  const source='Name;Quantity;Buy Price;Currency\n"<img src=x onerror=alert(1)>";4;7,50;EUR';
  await page.locator('#documentFile').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(source)});
  await page.locator('#analyze').click();
  await expect(page.locator('#reviewCards')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#reviewCards img')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Hankintahinta uusi arvo'})).toHaveValue('7.5');
  const price=page.getByRole('textbox',{name:'Hankintahinta uusi arvo'});
  await price.fill('');
  await page.getByRole('button',{name:'Vahvista Hankintahinta'}).click();
  await expect(page.getByRole('status')).toContainText('Korjausta ei hyväksytty');
  await expect(page.locator('#draftSummary')).toContainText('0 korjausta');
});

test('screenshot without a verified table displays source OCR text, never guessed holdings',async({page,context})=>{
  const external=[];
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!['localhost','127.0.0.1'].includes(url.hostname)){
      external.push(url.href);return route.abort();
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
  const png=await synthPng(page);
  await page.locator('#documentFile').setInputFiles({
    name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')
  });
  await page.locator('#analyze').click();
  await expect(page.locator('#draftPanel')).toBeVisible();
  await expect(page.locator('#reviewCards')).toContainText('SYNTHETIC 7');
  await expect(page.locator('#issueItems')).toContainText('NO_VERIFIED_HOLDINGS_TABLE');
  await expect(page.locator('#reviewCards')).toContainText('OCR-tekstirivi (ei omistus)');
  await expect(page.locator('#reviewCards')).not.toContainText('Kappalemäärä');
  await expect(page.locator('#sourcePreview')).toBeVisible();
  expect(external).toEqual([]);
  await page.locator('#cancel').click();
  await expect(page.locator('#sourcePreview')).toHaveAttribute('src',null);
  expect(await storage(page)).toBe('KEEP_ME');
});

test('cancel during delayed OCR cannot revive a discarded draft',async({page})=>{
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
  const png=await synthPng(page);
  await page.locator('#documentFile').setInputFiles({
    name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')
  });
  await page.locator('#analyze').click();
  await expect.poll(()=>page.evaluate(()=>window.waitStarted===true)).toBe(true);
  await page.locator('#cancel').click();
  await page.evaluate(()=>window.releaseReview());
  await page.waitForTimeout(150);
  await expect(page.locator('#draftPanel')).toBeHidden();
  await expect(page.locator('#reviewCards .card')).toHaveCount(0);
  expect(await storage(page)).toBe('KEEP_ME');
});

test('mismatched file type remains blocked; refreshing forgets all unpersisted corrections',async({page})=>{
  await prepare(page);
  await page.locator('#kind').selectOption('payroll');
  await page.locator('#documentFile').setInputFiles({
    name:'wrong.csv',mimeType:'text/csv',buffer:Buffer.from('Name;Qty\nX;4')
  });
  await page.locator('#analyze').click();
  await expect(page.getByRole('status')).toContainText('vain tekstipohjaisen PDF:n');
  await expect(page.locator('#draftPanel')).toBeHidden();
  await page.locator('#sampleHoldings').click();
  const input=page.getByRole('textbox',{name:'Kappalemäärä uusi arvo'}).first();
  await input.fill('30');
  await page.getByRole('button',{name:'Vahvista Kappalemäärä'}).first().click();
  await expect(page.locator('#draftSummary')).toContainText('1 korjausta');
  await page.reload();
  await expect(page.locator('#draftPanel')).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Valitse esimerkki');
  expect(await storage(page)).toBe('KEEP_ME');
});
