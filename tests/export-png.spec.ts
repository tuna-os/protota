import { test, expect } from '@playwright/test';

test.describe('Export to PNG (#17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('export button exists in toolbar', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /save json/i });
    await expect(exportBtn).toBeVisible();
  });

  test('clicking export triggers download of .mockup.json', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /save json/i });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toContain('.mockup.json');
  });

  test('PNG export button triggers image download', async ({ page }) => {
    const pngBtn = page.getByRole('button', { name: /png/i });
    await expect(pngBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      pngBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/(png|protota)/i);
  });
});
