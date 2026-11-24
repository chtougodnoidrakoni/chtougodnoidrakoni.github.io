import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:8787';
async function as(page: Page, q: string) {
  const init = await (await page.request.get(`${API}/dev/init?${q}`)).text();
  await page.addInitScript(([api, i]) => { localStorage.setItem('api-override', api!); localStorage.setItem('dev-init', i!); }, [API, init]);
}

test('Telegram-приложение: администратор создаёт игру, игрок записывается и отменяет', async ({ browser }) => {
  const errors: string[] = [];
  // администратор
  const a = await browser.newContext({ ...test.info().project.use });
  const admin = await a.newPage(); admin.on('pageerror', (e) => errors.push(e.message));
  await as(admin, 'id=1&username=astrakhan_trener&name=Замир');
  await admin.goto('./app/');
  await expect(admin.getByText('Привет, Замир!')).toBeVisible();
  await admin.getByRole('button', { name: 'Управление' }).click();
  await admin.getByRole('button', { name: 'Новая игра' }).click();
  await admin.locator('input[type=file]').setInputFiles('public/icons/icon-512.png');
  await admin.locator('label:has-text("Название") input').fill('Тени Драккенхейма');
  const d = new Date(Date.now() + 3 * 86400000); const local = new Date(d.getTime() + 4 * 3600000).toISOString().slice(0, 10) + 'T18:30';
  await admin.getByLabel('Дата и время').fill(local);
  await admin.getByRole('button', { name: 'Зелёная комната' }).click();
  await admin.locator('label:has-text("Мастер") input').first().fill('Катя');
  await admin.locator('label:has-text("Сеттинг") input').fill('Тёмное фэнтези');
  await admin.locator('label:has-text("Описание") textarea').fill('Город, павший под метеоритом. Ваншот для новичков.');
  await expect(admin.locator('img[src*="/img/"]')).toHaveCount(0);
  await admin.getByRole('button', { name: 'Опубликовать игру' }).click();
  await expect(admin.getByRole('heading', { name: 'Тени Драккенхейма' })).toBeVisible();
  await expect(admin.locator(`img[src^="${API}/img/"]`)).toBeVisible();
  // игрок
  const p = await browser.newContext({ ...test.info().project.use });
  const player = await p.newPage(); player.on('pageerror', (e) => errors.push(e.message));
  await as(player, 'id=100&name=Лиса');
  await player.goto(`./app/?week=${local.slice(0, 10)}`);
  const card = player.getByRole('button', { name: 'Тени Драккенхейма' });
  await expect(card).toContainText('18:30');
  await expect(card).toContainText('Мастер: Катя');
  await expect(card).toContainText('6 св.');
  // в тот же день красная комната пустая — заглушка; игроку поставить игру нельзя
  const day = player.locator('section', { has: card });
  await expect(day.getByText('Свободно — игра не запланирована')).toBeVisible();
  await expect(player.getByText('Поставить игру')).toHaveCount(0);
  await expect(player.locator('section[aria-label]')).toHaveCount(7);
  await expect(player.getByRole('button', { name: 'Управление' })).toHaveCount(0);
  await player.screenshot({ path: 'e2e/shots/t1-list.png', fullPage: true });
  await card.click();
  await player.getByRole('button', { name: 'Записаться' }).click();
  await expect(player.getByRole('status')).toContainText('Вы записаны');
  await expect(player.getByText('Лиса')).toBeVisible();
  await player.screenshot({ path: 'e2e/shots/t2-game.png', fullPage: true });
  await player.goto('./app/');
  await player.getByRole('button', { name: 'Следующая неделя' }).first().click();
  await expect(player.locator('section[aria-label]')).toHaveCount(7);
  await player.goto('./app/#my');
  await expect(player.getByRole('button', { name: 'Тени Драккенхейма' })).toContainText('Вы записаны');
  // администратор: пустая клетка открывает новую игру с датой и комнатой
  await admin.goto(`./app/?week=${local.slice(0, 10)}`);
  await admin.getByRole('button', { name: /^Поставить игру:/ }).first().click();
  await expect(admin.getByRole('heading', { name: 'Новая игра' })).toBeVisible();
  await expect(admin.getByLabel('Дата и время')).toHaveValue(/T18:00$/);
  // мастер видит игрока и может отметить
  await admin.goto('./app/#game/1');
  await expect(admin.getByRole('button', { name: 'Пришёл: Лиса' })).toBeVisible();
  // отмена записи
  player.on('dialog', (dlg) => dlg.accept());
  await player.goto('./app/#game/1');
  await player.getByRole('button', { name: 'Отменить запись' }).click();
  await expect(player.getByRole('status')).toContainText('Запись отменена');
  const [w, h] = await player.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(h).toBeLessThanOrEqual(w + 1);
  expect(errors).toEqual([]);
});
