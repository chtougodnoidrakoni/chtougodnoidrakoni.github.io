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
  // макет
  await page.getByRole('button', { name: 'Макет' }).click();
  const rectOf = (label: string) => page.locator('.bw', { has: page.locator('.blk-label', { hasText: new RegExp(`^${label}$`) }) }).first();
  const portrait = page.locator('.bw').filter({ has: page.locator('.blk-image') }).first();
  const looks = rectOf('Внешность');
  await portrait.scrollIntoViewIfNeeded();
  const styleOf = (l: typeof portrait) => l.evaluate((e) => (e as HTMLElement).style.cssText);
  const s0 = await styleOf(portrait);
  const p0 = (await portrait.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, pts: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  await portrait.scrollIntoViewIfNeeded();
  const q0 = (await portrait.boundingBox())!, l0 = (await looks.boundingBox())!;
  const ls0 = await styleOf(looks);
  // долгое касание и перенос на «Внешность» — блоки меняются местами
  await touch('touchStart', [{ x: q0.x + 40, y: q0.y + 40 }]);
  await page.waitForTimeout(500);
  await touch('touchMove', [{ x: l0.x + l0.width / 2, y: l0.y + l0.height / 2 }]);
  await page.screenshot({ path: 'e2e/shots/02-swap-drag.png' });
  await touch('touchEnd', []);
  await expect(page.getByText('Блоки поменялись местами')).toBeVisible();
  const pick = (css: string) => css.replace(/transform[^;]*;?/, '').replace(/z-index[^;]*;?/, '').trim();
  expect(pick(await styleOf(portrait))).toBe(pick(ls0));
  expect(pick(await styleOf(looks))).toBe(pick(s0));
  await page.screenshot({ path: 'e2e/shots/03-swapped.png' }); await noOverflow(page, 'layout');
  // граница: «Внешность» (теперь слева сверху) растёт вправо — портрет справа уменьшается… проверим на паре «Цели»/«Задачи»
  const goals = rectOf('Цели'), tasks = rectOf('Задачи');
  await goals.scrollIntoViewIfNeeded();
  const t0 = (await tasks.boundingBox())!;
  await goals.click();
  const h = page.locator('.bw.sel .handle-r');
  const hb = (await h.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
  await page.mouse.move(hb.x + 40, hb.y + hb.height / 2, { steps: 6 }); await page.mouse.up();
  const t1 = (await tasks.boundingBox())!;
  expect(t1.x).toBeGreaterThan(t0.x + 20);
  expect(t1.x + t1.width).toBeCloseTo(t0.x + t0.width, 0);
  await page.screenshot({ path: 'e2e/shots/04-border.png' });
  // подпись блока меняется в инспекторе
  await page.locator('label:has-text("Подпись") input').fill('Мечты');
  await expect(goals.locator('.blk-label')).toHaveText('Мечты').catch(async () => expect(page.locator('.blk-label', { hasText: 'Мечты' })).toBeVisible());
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.locator('.blk-label', { hasText: /^Цели$/ })).toBeVisible();
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

test('два пальца масштабируют страницу и не трогают блоки', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Новый лист по шаблону клуба').click();
  await page.getByRole('button', { name: 'Макет' }).click();
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
  await expect(page.getByText('Блоки поменялись местами')).toHaveCount(0);
});
