import { test, expect } from '@playwright/test';

test.describe('Export to PNG (#17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  const openFileMenu = async (page: import('@playwright/test').Page) => {
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
  };

  test('Blueprint export command exists in the Export menu', async ({ page }) => {
    await openFileMenu(page);
    const exportBtn = page.getByRole('menuitem', { name: /export to blueprint/i });
    await expect(exportBtn).toBeVisible();
  });

  test('clicking Blueprint export triggers download of .blp', async ({ page }) => {
    await openFileMenu(page);
    const exportBtn = page.getByRole('menuitem', { name: /export to blueprint/i });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toContain('.blp');
  });

  test('PNG export action triggers image download', async ({ page }) => {
    await openFileMenu(page);
    const pngBtn = page.getByRole('menuitem', { name: /export screen to png/i });
    await expect(pngBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      pngBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/(png|protota)/i);
  });
});
