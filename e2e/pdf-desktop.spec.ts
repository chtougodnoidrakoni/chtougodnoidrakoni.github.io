import { test, expect } from '@playwright/test';
test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', isMobile: false, hasTouch: false });
test('компьютер: PDF скачивается файлом, без «Поделиться»', async ({ page }) => {
  await page.addInitScript(() => { (navigator as any).canShare = () => true; (navigator as any).share = async () => { throw new Error('share called'); }; });
  await page.goto('./'); await page.getByRole('button', { name: /D&D 5e/ }).click(); await page.getByRole('button', { name: /Для ваншота/ }).click();
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByText('PDF готов')).toBeVisible({ timeout: 30000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Сохранить или отправить/ }).click()]);
  expect(dl).toBeTruthy(); // скачалось, системное «Поделиться» не вызывалось
});
