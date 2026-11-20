import { test, expect, type Page } from '@playwright/test';
async function noOverflow(page: Page, where: string) {
  const [cw, sw] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(sw, `горизонтальная прокрутка: ${where}`).toBeLessThanOrEqual(cw + 1);
}

test('лист: заполнение, макет, заклинания, чарник, PDF', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByText('Новый лист по шаблону клуба').click();
  await expect(page.getByText('Заполнение')).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/01-bio.png' }); await noOverflow(page, 'bio');
  // заполнение имени
  await page.getByPlaceholder('Имя персонажа').fill('Гордрик Каменный');
  // характеристика
  const str = page.locator('.blk-ability').first().locator('.abil-score');
  await str.scrollIntoViewIfNeeded(); await str.fill('16');
  await expect(page.locator('.blk-ability').first().locator('.abil-mod')).toHaveValue('+3');
  // макет: перетащить блок «Портрет»
  await page.getByRole('button', { name: 'Макет' }).click();
  const portrait = page.locator('.bw').filter({ has: page.locator('.blk-image') }).first();
  await portrait.scrollIntoViewIfNeeded();
  const box = (await portrait.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  await expect(page.getByText('Картинка')).toBeVisible(); // инспектор открылся
  await page.screenshot({ path: 'e2e/shots/02-layout.png' }); await noOverflow(page, 'layout');
  const box2 = (await portrait.boundingBox())!;
  expect(box2.x).toBeGreaterThan(box.x + 10);
  // подпись и шрифт
  // подпись блока меняется в инспекторе
  await page.locator('label:has-text("Подпись") input').fill('Портрет героя');
  await expect(page.locator('.blk-image .blk-label')).toHaveText('Портрет героя');
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.locator('.blk-image .blk-label')).toHaveText('Портрет');
  // заполнение → добавить заклинания
  await page.getByRole('button', { name: 'Заполнение' }).click();
  const add = page.locator('.add-spell').first();
  await add.scrollIntoViewIfNeeded(); await add.click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('fire');
  await page.getByText('Fire Bolt').click();
  await page.getByRole('button', { name: 'Готово' }).click();
  const add2 = page.locator('.add-spell').nth(1);
  await add2.scrollIntoViewIfNeeded(); await add2.click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('fireball');
  await page.getByText('Fireball').first().click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('shield');
  await page.getByRole('button', { name: /^Щит 1 круг/ }).click();
  await page.getByRole('button', { name: 'Своё заклинание' }).click();
  await page.locator('label:has-text("Название") input').fill('Удар грома клуба');
  await page.locator('textarea').last().fill('Своё описание заклинания для проверки чарника.');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.locator('.sp-name', { hasText: 'Fireball' })).toBeVisible();
  await page.locator('.sb-col .sp-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'e2e/shots/03-spellbook.png' }); await noOverflow(page, 'spellbook');
  await expect(page.locator('.sb-col .sp-card')).toHaveCount(4);
  // ячейка закрашивается
  const circ = page.locator('.circ').first(); await circ.scrollIntoViewIfNeeded(); await circ.click();
  await expect(circ).toHaveClass(/on/);
  // сохранение переживает перезагрузку
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByPlaceholder('Имя персонажа')).toHaveValue('Гордрик Каменный', { timeout: 15000 });
  // PDF
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: 'e2e/shots/sheet.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect(errors).toEqual([]);
});
