import { test, expect } from '@playwright/test';

test('из Telegram-приложения можно вернуться назад с листа и из билдера', async ({ page }) => {
  for (const path of ['/?tg=1', '/builder/?tg=1']) {
    await page.goto(path);
    const back = page.getByRole('button', { name: 'Назад в приложение клуба' });
    await expect(back).toBeVisible();
    await expect(page).not.toHaveURL(/tg=1/);
    await page.screenshot({ path: `/tmp/back${path.length}.png` });
    await page.reload();
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/app\/$/);
  }
});

test('без Telegram кнопки «назад» нет', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Назад в приложение клуба' })).toHaveCount(0);
});
