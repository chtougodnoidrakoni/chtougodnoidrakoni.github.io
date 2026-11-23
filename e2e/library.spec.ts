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
