import {test,expect} from '@playwright/test';

test('public LAB release artifact keeps previous home and serves fictional isolated issue55 OCR',async({page,context})=>{
  test.skip(process.env.REAL_OCR_QA!=='1','Pinned local OCR required');
  test.setTimeout(240000);
  const outbound=[];
  await context.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='localhost'&&host!=='127.0.0.1'){outbound.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.setViewportSize({width:360,height:780});
  await page.goto('/dist/index.html');
  await expect(page.locator('#fileImport')).toHaveCount(1);
  await page.goto('/dist/issue55-test/demo/portfolio-identity-review.html');
  await expect(page.locator('#portfolioFile')).toBeHidden();
  await expect(page.getByText('Oikeiden salkku- tai pankkikuvien lataaminen')).toBeVisible();
  await page.getByRole('button',{name:'Puuttuva nimi'}).click();
  await page.getByRole('button',{name:'Lue kuva',exact:true}).click();
  await expect(page.locator('#pendingRows article')).toHaveCount(3,{timeout:120000});
  await expect(page.locator('#pendingRows article').first()).toContainText('Growth bucket');
  await expect(page.locator('#pendingRows article').first()).toContainText('Varmentamaton tekstihavainto');
  await page.locator('#pendingRows article').first().getByRole('button',{name:'Korjaa nimi'}).click();
  const input=page.getByRole('textbox',{name:'Oikea instrumentin nimi'});
  await expect(input).toHaveValue('');
  await input.fill('Amber Circuit');await input.press('Enter');
  await expect(page.locator('#reviewedRows article')).toHaveCount(1);
  await expect(page.locator('#pendingRows article')).toHaveCount(2);
  await expect(page.locator('#reviewedRows article')).toContainText('Amber Circuit');
  await expect(page.getByRole('button',{name:'Hae paikallisesta testihakemistosta'})).toBeDisabled();
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(outbound).toEqual([]);
});
