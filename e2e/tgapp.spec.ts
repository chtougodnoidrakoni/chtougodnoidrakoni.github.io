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
  await admin.getByRole('button', { name: 'Админ' }).click();
  // список мастеров: стартовые уже есть, добавляем нового
  await expect(admin.getByText('@i_koschei_i')).toBeVisible();
  await admin.getByLabel('Имя мастера').fill('Лёня'); await admin.getByLabel('Ник мастера').fill('@Krodys');
  await admin.getByRole('button', { name: 'Добавить мастера' }).click();
  await expect(admin.getByText('@krodys')).toBeVisible();
  await admin.screenshot({ path: 'e2e/shots/t7-masters.png' });
  await admin.getByRole('button', { name: 'Новая игра' }).click();
  await expect(admin.getByRole('group', { name: 'Мастер' }).getByRole('button', { name: 'Лёня' })).toBeVisible();
  await admin.locator('input[type=file]').setInputFiles('public/icons/icon-512.png');
  await admin.locator('label:has-text("Название") input').fill('Тени Драккенхейма');
  const d = new Date(Date.now() + 3 * 86400000); const local = new Date(d.getTime() + 4 * 3600000).toISOString().slice(0, 10) + 'T18:30';
  await admin.getByLabel('Дата и время').fill(local);
  await admin.getByRole('button', { name: 'Зелёная комната' }).click();
  // мастер — кнопкой из списка, а новый мастер добавляется во вкладке «Админ»
  await admin.getByRole('group', { name: 'Мастер' }).getByRole('button', { name: 'Катя' }).click();
  await expect(admin.getByRole('group', { name: 'Мастер' }).getByRole('button', { name: 'Катя' })).toHaveAttribute('aria-pressed', 'true');
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
  await expect(card).toContainText('6 мест');
  await expect(card).toContainText('Зелёная комната');
  await card.locator('..').screenshot({ path: 'e2e/shots/t6-tiles.png' });
  // в тот же день красная комната пустая — заглушка; игроку поставить игру нельзя
  const day = player.locator('section', { has: card });
  await expect(day.getByText('Стол свободен для выкупа.')).toBeVisible();
  await expect(day.getByRole('button', { name: /Выкупить стол/ })).toBeVisible();
  await expect(player.getByText('Поставить игру')).toHaveCount(0);
  await expect(player.locator('section[aria-label]')).toHaveCount(7);
  await expect(player.getByRole('button', { name: 'Админ' })).toHaveCount(0);
  await player.screenshot({ path: 'e2e/shots/t1-list.png', fullPage: true });
  await card.click();
  await player.getByRole('button', { name: 'Записаться' }).click();
  const rules = player.getByRole('dialog', { name: 'Правила записи' });
  await expect(rules).toContainText('Предоплата сейчас');
  await expect(rules).toContainText('700 ₽');
  await player.screenshot({ path: 'e2e/shots/t2-rules.png' });
  await expect(rules.getByRole('button', { name: 'Написать администратору' })).toBeVisible();
  await expect(rules.getByRole('button', { name: /записаться/i })).toHaveCount(0);
  await rules.getByRole('button', { name: 'Отмена' }).click();
  // записывает администратор; здесь — прямым запросом от имени игрока
  await player.evaluate(async (api) => { await fetch(`${api}/api/games/1/join`, { method: 'POST', headers: { 'x-init-data': localStorage.getItem('dev-init')! } }); }, API);
  await player.reload();
  await expect(player.getByText('Лиса')).toBeVisible();
  await player.screenshot({ path: 'e2e/shots/t2-game.png', fullPage: true });
  await player.goto('./app/');
  await player.getByRole('button', { name: 'Следующая неделя' }).first().click();
  await expect(player.locator('section[aria-label]')).toHaveCount(7);
  await player.getByRole('button', { name: 'О клубе' }).click();
  await player.getByText('Цены', { exact: true }).click();
  await expect(player.getByText('Абонемент на кампанию')).toBeVisible();
  await player.getByText('ДнД-день рождения', { exact: true }).click();
  await expect(player.getByRole('button', { name: 'Обсудить праздник' })).toBeVisible();
  await player.screenshot({ path: 'e2e/shots/t4-info.png', fullPage: true });
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
  // все места заняты — записаться нельзя, предлагаем написать администратору
  await admin.goto('./app/#game/1');
  for (let i = 1; i <= 6; i++) {
    await admin.getByLabel('Имя гостя').fill(`Гость ${i}`);
    await admin.getByLabel('Имя гостя').press('Tab');
    await admin.locator('button:has(svg.lucide-plus)').last().click();
    await expect(admin.getByText(`Гость ${i}`, { exact: true })).toBeVisible();
  }
  await player.reload();
  await player.getByRole('button', { name: 'Мест нет' }).click();
  const full = player.getByRole('dialog', { name: 'Мест нет' });
  await expect(full).toContainText('Попробуйте записаться на другое время');
  await expect(full.getByRole('button', { name: 'Написать администратору' })).toBeVisible();
  await player.screenshot({ path: 'e2e/shots/t3-full.png' });
  const [w, h] = await player.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(h).toBeLessThanOrEqual(w + 1);
  expect(errors).toEqual([]);
});

test('Telegram-приложение: из «Изменить игру» можно вернуться к игре и в расписание', async ({ browser }) => {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await as(admin, 'id=1&username=astrakhan_trener&name=Замир');
  await admin.goto('./app/#game/1');
  await admin.getByRole('button', { name: 'Изменить' }).click();
  await expect(admin.getByRole('heading', { name: 'Изменить игру' })).toBeVisible();
  await admin.getByRole('button', { name: 'К игре' }).click();
  await expect(admin).toHaveURL(/#game\/1$/);
  await admin.getByRole('button', { name: 'Все игры' }).click();
  await expect(admin.locator('section[aria-label]').first()).toBeVisible();
  await expect(admin).not.toHaveURL(/#game|#edit/);
});

test('Telegram-приложение: администратор открывает пост недели для канала', async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  await as(admin, 'id=1&username=astrakhan_trener&name=Замир');
  await admin.goto('./app/');
  await admin.getByRole('button', { name: /выложить в канал/ }).click();
  const d = admin.getByRole('dialog', { name: 'Выложить в канал' });
  await expect(d).toContainText('Расписание на неделю');
  await expect(d.getByRole('button', { name: 'Выложить в канал' })).toBeDisabled(); // без картинки нельзя
  await admin.screenshot({ path: 'e2e/shots/t5-post.png' });
});
