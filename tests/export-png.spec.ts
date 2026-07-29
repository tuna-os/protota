import { test, expect } from '@playwright/test';

test.describe('Export to PNG (#17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  const openFileMenu = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'File' }).click();
  };

  test('export command exists in the File menu', async ({ page }) => {
    await openFileMenu(page);
    const exportBtn = page.getByText('Export...', { exact: true });
    await expect(exportBtn).toBeVisible();
  });

  test('clicking export triggers download of .mockup.json', async ({ page }) => {
    await openFileMenu(page);
    const exportBtn = page.getByText('Export...', { exact: true });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toContain('.mockup.json');
  });

  test('PNG export button triggers image download', async ({ page }) => {
    await openFileMenu(page);
    const pngBtn = page.getByText('Export as PNG', { exact: true });
    await expect(pngBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      pngBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/(png|protota)/i);
  });
});
