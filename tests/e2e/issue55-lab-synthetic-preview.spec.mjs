import {test,expect} from '@playwright/test';

test('isolated LAB sample-only phone path: real image pixels, real OCR, no brokerage upload',async({page,context})=>{
  test.skip(process.env.REAL_OCR_QA!=='1','Requires pinned local OCR');
  test.setTimeout(240000);
  const outside=[];
  await context.route('**/*',route=>{
    if(!['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)){
      outside.push(route.request().url);return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({width:360,height:780});
  await page.goto('/dist/demo/portfolio-identity-review.html');
  await expect(page.locator('#portfolioFile')).toBeHidden();
  await expect(page.getByText('Oikeiden salkku- tai pankkikuvien lataaminen')).toBeVisible();
  await page.getByRole('button',{name:'Haalea nimi'}).click();
  await expect(page.locator('#sampleHelp')).toContainText('Haalea nimi valittu');
  await page.getByRole('button',{name:'Lue kuva',exact:true}).click();
  await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});
  await expect(page.locator('#pendingRows article').first()).toContainText('Growth bucket');
  await expect(page.locator('#pendingRows article').first()).toContainText('Varmentamaton tekstihavainto');
  await expect(page.getByText('Instrumentit varmentamatta. Ei tallennuslupaa.')).toBeVisible();
  await page.locator('#pendingRows article').first().getByRole('button',{name:'Korjaa nimi'}).click();
  const input=page.getByRole('textbox',{name:'Oikea instrumentin nimi'});
  await input.fill('Amber Circuit');
  await input.press('Enter');
  await expect(page.locator('#reviewedRows article')).toHaveCount(1);
  await expect(page.locator('#reviewedRows article')).toContainText('Amber Circuit');
  await expect(page.locator('#pendingRows article')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Hae paikallisesta testihakemistosta'})).toBeDisabled();
  await page.getByRole('button',{name:'Peruuta ja tyhjennä'}).click();
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'Selkeä vertailukuva'}).click();
  await page.getByRole('button',{name:'Lue kuva',exact:true}).click();
  await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});
  await expect(page.locator('#pendingRows article').first()).toContainText('Amber Circuit');
  await expect(page.locator('#portfolioFile')).toBeHidden();
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
  expect(outside).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
