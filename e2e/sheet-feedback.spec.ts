import { test, expect } from '@playwright/test';

// пожелания хозяйки клуба после заполнения листа
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('fill-mode', 'modal')); });

test('ваншот: классическая первая страница, автоподсчёт магии, кости хитов, компетентность, оформление записей', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: /D&D 5e/ }).click();
  await page.getByRole('button', { name: /Для ваншота/ }).click();
  await expect(page.getByRole('button', { name: 'Изменить страницу Характеристики' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменить страницу Биография' })).toHaveCount(0);
  const blk = (label: string) => page.locator(`.bw[data-label="${label}"]`).first();
  const save = () => page.getByRole('button', { name: 'Сохранить' }).click();
  const put = async (label: string, v: string) => { await blk(label).click(); await page.getByLabel(/Что вписать|Число/).fill(v); await save(); };

  await put('Имя персонажа', 'Мирра');
  await put('Класс', 'Волшебник');
  await put('Уровень', '3');
  await blk('Интеллект').click(); await page.getByLabel('Значение').fill('16');
  // компетентность на «Анализе»: +3 (ИНТ) + 2×2
  await page.getByRole('button', { name: 'Компетентность: Анализ' }).click();
  await page.screenshot({ path: 'e2e/shots/fb-1-expertise.png' });
  await save();
  await expect(blk('Интеллект').locator('.abx-row', { hasText: 'Анализ' }).locator('.abx-val')).toHaveText('+7');
  await expect(blk('Интеллект').locator('.dot.exp')).toHaveCount(1);
  // инициатива: «2» превращается в «+2»
  await put('Инициатива', '2');
  await expect(blk('Инициатива').locator('input')).toHaveValue('+2');
  // кости хитов: по классу сами, можно выбрать кость кнопкой
  await expect(blk('Кости хитов').locator('input')).toHaveValue('3к6');
  await blk('Кости хитов').click();
  await page.getByRole('button', { name: 'к8' }).click();
  await page.screenshot({ path: 'e2e/shots/fb-2-hitdice.png' });
  await save();
  await expect(blk('Кости хитов').locator('input')).toHaveValue('3к8');
  await page.screenshot({ path: 'e2e/shots/fb-3-oneshot.png' });
  // магия: характеристика, СЛ и бонус атаки посчитаны сами, ячеек — только 1 и 2 круг
  await blk('СЛ спасброска').scrollIntoViewIfNeeded();
  await expect(blk('Характеристика').locator('input')).toHaveValue('Интеллект');
  await expect(blk('СЛ спасброска').locator('input')).toHaveValue('13');
  await expect(blk('Бонус атаки').locator('input')).toHaveValue('+5');
  await expect(blk('Ячейки заклинаний').locator('.circ')).toHaveCount(6);
  await page.screenshot({ path: 'e2e/shots/fb-4-magic.png' });
  // таблица оружия: попадание, урон, бонус к урону
  await expect(blk('Оружие').locator('th').nth(1)).toHaveText('Бонус к попаданию');
  await expect(blk('Оружие').locator('th').nth(2)).toHaveText('Урон');
  // записи с оформлением
  await blk('Заметки').scrollIntoViewIfNeeded(); await blk('Заметки').click();
  const ta = page.locator('textarea').first();
  await ta.fill('Важно: долг гильдии');
  await ta.evaluate((e: HTMLTextAreaElement) => e.setSelectionRange(0, 5));
  await page.getByRole('button', { name: 'Жирный' }).click();
  await expect(ta).toHaveValue('**Важно**: долг гильдии');
  await page.screenshot({ path: 'e2e/shots/fb-5-rich.png' });
  await save();
  await expect(blk('Заметки').locator('.rt b')).toHaveText('Важно');
  // сохранить на устройство — кнопка в шапке
  await expect(page.getByRole('button', { name: 'Скачать файл листа на устройство' })).toBeVisible();
  expect(errors).toEqual([]);
});
