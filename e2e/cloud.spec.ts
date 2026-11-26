import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:8787';
async function as(page: Page, q: string) {
  const init = await (await page.request.get(`${API}/dev/init?${q}`)).text();
  await page.addInitScript(([api, i]) => { localStorage.setItem('api-override', api!); localStorage.setItem('dev-init', i!); localStorage.setItem('fill-mode', 'modal'); }, [API, init]);
}

test('облако: лист с одного устройства виден в боте и открывается на другом', async ({ browser }) => {
  const phone = await (await browser.newContext()).newPage();
  await as(phone, 'id=777&username=cloud_user&name=Игрок');
  await phone.goto('./');
  await phone.getByRole('button', { name: /D&D 5e/ }).click();
  await phone.getByRole('button', { name: /Для ваншота/ }).click();
  await phone.locator('.bw[data-label="Имя персонажа"]').first().click();
  await phone.getByLabel('Что вписать').fill('Облачная Мирра');
  await phone.getByRole('button', { name: 'Сохранить' }).click();
  // в боте, вкладка «Мои»
  const bot = await (await browser.newContext()).newPage();
  await as(bot, 'id=777&username=cloud_user&name=Игрок');
  await bot.goto('./app/#my');
  await expect.poll(async () => { await bot.reload(); return bot.getByRole('button', { name: /Облачная Мирра/ }).count(); }, { timeout: 20000 }).toBe(1);
  await bot.screenshot({ path: 'e2e/shots/c1-my-sheets.png' });
  // «другое устройство»: пустой браузер, тот же аккаунт — лист подтягивается и открывается
  await bot.getByRole('button', { name: /Облачная Мирра/ }).click();
  await expect(bot.locator('.bw[data-label="Имя персонажа"] input').first()).toHaveValue('Облачная Мирра', { timeout: 15000 });
});
