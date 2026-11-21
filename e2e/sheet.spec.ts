import { test, expect, type Page } from '@playwright/test';
async function noOverflow(page: Page, where: string) {
  const [cw, sw] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(sw, `горизонтальная прокрутка: ${where}`).toBeLessThanOrEqual(cw + 1);
}

test('лист: заполнение в окне, редактор страницы, заклинания, чарник, PDF', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: /D&D 5e/ }).click();
  await expect(page.getByRole('button', { name: 'Изменить страницу Биография' })).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/01-bio.png' }); await noOverflow(page, 'bio');
  const blk = (label: string) => page.locator(`.bw[data-label="${label}"]`).first();
  const save = () => page.getByRole('button', { name: 'Сохранить' }).click();
  // имя: касание блока открывает окно, страница не меняется до «Сохранить»
  await blk('Имя персонажа').click();
  await page.getByLabel('Что вписать').fill('Гордрик Каменный');
  await page.screenshot({ path: 'e2e/shots/02-fill-modal.png' });
  await save();
  await expect(blk('Имя персонажа').locator('input')).toHaveValue('Гордрик Каменный');
  // кнопки шрифта в текстовом блоке: меняют размер, окно заполнения не открывают
  const area = blk('Внешность').locator('textarea');
  const fs0 = await area.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await page.getByRole('button', { name: 'Больше шрифт: Внешность' }).click();
  await page.getByRole('button', { name: 'Больше шрифт: Внешность' }).click();
  await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);
  expect(await area.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(fs0);
  const lbl = blk('Внешность').locator('.blk-label');
  const l0 = await lbl.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await page.getByRole('button', { name: 'Меньше шрифт: Внешность' }).click();
  expect(await lbl.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBe(l0);
  await page.screenshot({ path: 'e2e/shots/05-font-buttons.png' });
  // характеристика и автонавык
  await blk('Сила').scrollIntoViewIfNeeded(); await blk('Сила').click();
  await page.getByLabel('Значение').fill('16');
  await save();
  await expect(blk('Сила').locator('.abx-mod')).toHaveText('+3');
  await expect(blk('Сила').locator('.abx-row', { hasText: 'Атлетика' }).locator('.abx-val')).toHaveText('+3');
  // отмена ничего не меняет
  await blk('Сила').click(); await page.getByLabel('Значение').fill('8');
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(blk('Сила').locator('.abx-mod')).toHaveText('+3');

  // редактор страницы «Биография»
  await page.getByRole('button', { name: 'Изменить страницу Биография' }).click();
  const goals = blk('Цели'), tasks = blk('Задачи');
  await goals.scrollIntoViewIfNeeded();
  const t0 = (await tasks.boundingBox())!;
  await goals.click();
  await expect(goals).toHaveClass(/sel/);
  await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);
  const hb = (await page.locator('.bw.sel .handle-r').boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
  await page.mouse.move(hb.x + 40, hb.y + hb.height / 2, { steps: 6 }); await page.mouse.up();
  const t1 = (await tasks.boundingBox())!;
  expect(t1.x).toBeGreaterThan(t0.x + 20);
  expect(t1.x + t1.width).toBeCloseTo(t0.x + t0.width, 0);
  await page.screenshot({ path: 'e2e/shots/03-border.png' }); await noOverflow(page, 'layout');
  // удалить «Цели» — «Задачи» занимают всю ширину
  await page.getByRole('button', { name: 'Удалить блок' }).click();
  await expect(goals).toHaveCount(0);
  const name = (await blk('Имя персонажа').boundingBox())!;
  const t2 = (await tasks.boundingBox())!;
  expect(Math.abs(t2.x - name.x)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(goals).toHaveCount(1);
  await page.getByRole('button', { name: 'Готово' }).first().click();

  // заклинания через окно блока
  await blk('Заговоры').scrollIntoViewIfNeeded(); await blk('Заговоры').click();
  await page.getByRole('button', { name: 'Добавить заклинания' }).click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('огненный');
  await page.getByText('Огненный снаряд').click();
  await page.getByRole('button', { name: 'Готово' }).last().click();
  await save();
  await blk('Заклинания').scrollIntoViewIfNeeded(); await blk('Заклинания').click();
  await page.getByRole('button', { name: 'Добавить заклинания' }).click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('огненный шар');
  await page.getByText('Огненный шар').first().click();
  await page.getByPlaceholder('Название (по-английски или по-русски)').fill('щит');
  await page.getByRole('button', { name: /^Щит 1 круг/ }).click();
  await page.getByRole('button', { name: 'Своё заклинание' }).click();
  await page.locator('label:has-text("Название") input').last().fill('Удар грома клуба');
  await page.locator('textarea').last().fill('Своё описание заклинания для проверки чарника.');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: 'Готово' }).last().click();
  await save();
  await expect(page.locator('.sp-name', { hasText: 'Огненный шар' })).toBeVisible();
  await page.locator('.sb-col .sp-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'e2e/shots/04-spellbook.png' }); await noOverflow(page, 'spellbook');
  await expect(page.locator('.sb-col .sp-card')).toHaveCount(4);
  // кружки спасбросков от смерти
  await blk('Спасброски от смерти').scrollIntoViewIfNeeded(); await blk('Спасброски от смерти').click();
  await page.getByRole('button', { name: 'Успехи 1' }).click();
  await save();
  await expect(blk('Спасброски от смерти').locator('.circ.on')).toHaveCount(1);
  // сохранение переживает перезагрузку
  await page.waitForTimeout(800);
  await page.reload();
  await expect(blk('Имя персонажа').locator('input')).toHaveValue('Гордрик Каменный', { timeout: 15000 });
  // PDF
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: 'e2e/shots/sheet.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect(errors).toEqual([]);
});

test('два пальца масштабируют страницу и не трогают блоки', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /D&D 5e/ }).click();
  const portrait = page.locator('.bw').filter({ has: page.locator('.blk-image') }).first();
  await portrait.scrollIntoViewIfNeeded();
  const css = () => portrait.evaluate((e) => (e as HTMLElement).style.cssText);
  const s0 = await css();
  const p0 = (await portrait.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, pts: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  await touch('touchStart', [{ x: p0.x + 40, y: p0.y + 40 }]);
  await touch('touchStart', [{ x: p0.x + 40, y: p0.y + 40 }, { x: p0.x + 120, y: p0.y + 120 }]);
  await touch('touchMove', [{ x: p0.x + 10, y: p0.y + 10 }, { x: p0.x + 160, y: p0.y + 170 }]);
  await page.waitForTimeout(500);
  await touch('touchMove', [{ x: p0.x, y: p0.y }, { x: p0.x + 180, y: p0.y + 200 }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  expect(await css()).toBe(s0);
  await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);
});
