import { test, expect } from '@playwright/test';

test('библиотека: импорт пакета и новый класс в сборке', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./builder/');
  await page.getByText('Классическая пятая редакция').click();
  await page.getByRole('button', { name: 'Библиотека контента' }).click();
  await expect(page.getByText('Общие пакеты клуба')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/test_pack.txt');
  await expect(page.getByText('Предпросмотр: Пакет для проверки')).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/l1-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Импортировать', exact: true }).click();
  await expect(page.getByText(/Готово: «Пакет для проверки»/)).toBeVisible();
  // повторный импорт того же файла — дубликат, кнопка не нажимается
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/test_pack.txt');
  await expect(page.getByText(/уже импортирован без изменений/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Импортировать', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Отменить' }).click();
  await page.getByRole('button', { name: 'Назад к сборке' }).click();
  await page.getByRole('button', { name: '3. Класс' }).click();
  await page.getByRole('button', { name: /^Испытатель/ }).click();
  await page.getByRole('button', { name: '2. Уровень' }).click();
  await page.getByRole('button', { name: 'Уровень 3', exact: true }).click();
  await page.getByRole('button', { name: '3. Класс' }).click();
  await page.getByText('Путь проверки').click();
  await expect(page.getByText(/3 ур\.: .*Проверка \(Путь проверки\)/)).toBeVisible();
  // подкласс SRD из общего пакета клуба — с настоящими способностями
  await page.getByRole('button', { name: /^Воин/ }).click();
  await page.getByText('Чемпион').click();
  await expect(page.getByText(/Улучшенный критический удар \(Чемпион\)/)).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/l2-class.png' });
  expect(errors).toEqual([]);
});

test('библиотека: импорт вида и выбор в сборке', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./builder/#library');
  await expect(page.getByRole('button', { name: '+ Импорт видов (Races)' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/race_pack.txt');
  await expect(page.getByText('Новые виды: Сильф')).toBeVisible();
  await expect(page.getByText('Новые подрасы: Грозовой сильф')).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/l3-races.png' });
  await page.getByRole('button', { name: 'Импортировать', exact: true }).click();
  await expect(page.getByText(/видов 1, подрас 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Назад к сборке' }).click();
  await page.getByText('Классическая пятая редакция').click();
  await page.getByRole('button', { name: '4. Вид' }).click();
  await page.getByRole('button', { name: /^Сильф/ }).click();
  await page.getByText('Грозовой сильф').click();
  await expect(page.getByText('Лёгкий шаг.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('библиотека: черты и предыстории — импорт, своя черта, выбор с предусловием', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./builder/#library');
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/fb_pack.txt');
  await expect(page.getByText('Новые черты: Силач')).toBeVisible();
  await expect(page.getByText('Новые предыстории: Моряк')).toBeVisible();
  await page.getByRole('button', { name: 'Импортировать', exact: true }).click();
  // своя черта через редактор
  await page.getByRole('button', { name: 'Черты', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.locator('label:has-text("Название (рус.)") input').fill('Стойкий');
  await page.locator('label:has-text("Название (англ.)") input').fill('Steadfast');
  await page.locator('label:has-text("Источник") input').fill('Клуб');
  await page.locator('label:has-text("Описание") textarea').last().fill('Своя черта для проверки.');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: 'Редактировать: Стойкий' })).toBeVisible();
  await page.getByLabel('Предусловие', { exact: true }).selectOption('yes');
  await expect(page.getByText('Силач')).toBeVisible(); await expect(page.getByText('Стойкий')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/shots/l4-catalog.png', fullPage: true });
  await page.getByRole('button', { name: 'Назад к сборке' }).click();
  await page.getByText('Классическая пятая редакция').click();
  await page.getByRole('button', { name: '2. Уровень' }).click(); await page.getByRole('button', { name: 'Уровень 4', exact: true }).click();
  await page.getByRole('button', { name: '3. Класс' }).click(); await page.getByRole('button', { name: /^Воин/ }).click();
  await page.getByRole('button', { name: '5. Предыстория' }).click(); await page.getByRole('button', { name: /^Моряк/ }).click();
  await expect(page.getByText('Место на корабле.')).toBeVisible();
  await page.getByRole('button', { name: '7. Улучшения' }).click();
  await page.getByRole('button', { name: 'Черта', exact: true }).click();
  const sel = page.getByLabel('Черта 4', { exact: true });
  await expect(sel.locator('option', { hasText: 'Силач' })).toBeDisabled();
  await sel.selectOption('steadfast');
  await expect(page.getByText('Своя черта для проверки.')).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/l5-feat.png' });
  expect(errors).toEqual([]);
});
