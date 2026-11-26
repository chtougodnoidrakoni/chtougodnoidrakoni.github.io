import { test, expect } from '@playwright/test';

test('сборка: волшебник 3 уровня от редакции до листа', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./builder/');
  const next = () => page.getByRole('button', { name: /^Дальше/ }).click();
  await page.getByText('Классическая пятая редакция').click(); await next();
  await page.getByRole('button', { name: 'Уровень 3', exact: true }).click(); await next();
  await page.getByRole('button', { name: /^Волшебник/ }).click();
  await page.getByText('Школа воплощения').click();
  await page.screenshot({ path: 'e2e/shots/b1-class.png' }); await next();
  await page.getByRole('button', { name: /^Эльф/ }).click();
  await page.getByText('Высший эльф').click(); await next();
  await page.getByRole('button', { name: /^Прислужник/ }).click(); await next();
  await page.getByRole('button', { name: /Расставить автоматически/ }).click();
  await expect(page.getByLabel('Интеллект', { exact: true })).toHaveValue('15');
  await expect(page.getByLabel('Сила', { exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Стандартный набор' }).click(); // сброс, дальше вручную
  const vals: Record<string, string> = { 'Сила': '8', 'Ловкость': '14', 'Телосложение': '13', 'Интеллект': '15', 'Мудрость': '12', 'Харизма': '10' };
  for (const [a, v] of Object.entries(vals)) await page.getByLabel(a, { exact: true }).selectOption(v);
  await page.screenshot({ path: 'e2e/shots/b2-abil.png' }); await next();
  await page.getByRole('button', { name: 'Магия', exact: true }).click();
  await page.getByRole('button', { name: 'История', exact: true }).click(); await next();
  await expect(page.getByText(/В книге 10, подготовлено/)).toBeVisible({ timeout: 10000 });
  for (const n of ['Огненный снаряд', 'Свет', 'Фокусы']) { await page.getByLabel('Поиск заклинания').fill(n); await page.getByRole('button', { name: `Взять: ${n}`, exact: true }).click(); }
  await page.getByLabel('Поиск заклинания').fill('');
  await page.getByRole('button', { name: /^Книга/ }).click();
  const take = page.getByRole('button', { name: /^Взять:/ });
  for (let i = 0; i < 10; i++) await take.first().click();
  const prep = page.getByRole('button', { name: /^Подготовить:/ });
  for (let i = 0; i < 6; i++) await prep.nth(i).click();
  await page.screenshot({ path: 'e2e/shots/b3-spells.png' }); await next();
  await page.getByRole('button', { name: 'Кинжал', exact: true }).click(); await next();
  await page.getByLabel('Имя персонажа').fill('Элиара'); await next();
  await expect(page.getByText('Осталось выбрать')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/shots/b4-done.png', fullPage: true });
  const [w, h] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(h).toBeLessThanOrEqual(w + 1);
  await page.getByRole('button', { name: 'Создать лист' }).click();
  await expect(page.locator('.bw[data-label="Имя персонажа"] input').first()).toHaveValue('Элиара', { timeout: 15000 });
  await expect(page.locator('.sp-name', { hasText: 'Огненный снаряд' })).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/b5-sheet.png' });
  expect(errors).toEqual([]);
});
