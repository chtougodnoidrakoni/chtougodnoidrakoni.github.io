import { test, expect } from '@playwright/test';

// эти проверки идут через окно заполнения
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('fill-mode', 'modal')); });
for (const [g, file] of [['Зов Ктулху', 'coc'], ['Клинки во тьме', 'bitd'], ['Киберпанк RED', 'cpr']] as const) {
  test(g, async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: new RegExp(g) }).click();
    await expect(page.locator('.page').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: `e2e/shots/${file}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
  });
}
test('Ктулху: заполнение процентов', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Зов Ктулху/ }).click();
  const con = page.locator('.bw[data-label="ВЫН · выносливость"]').first();
  await con.click(); await page.getByLabel('Значение, %').fill('60'); await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(con.locator('.pct-parts')).toContainText('30');
  await expect(con.locator('.pct-parts')).toContainText('12');
});
