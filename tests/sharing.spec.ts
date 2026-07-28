import { test, expect } from '@playwright/test';

test.describe('Shareable links (#25)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('Share button exists in toolbar', async ({ page }) => {
    const shareBtn = page.getByRole('button', { name: /share/i });
    await expect(shareBtn).toBeVisible();
  });

  test('clicking Share copies a URL to clipboard', async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const shareBtn = page.getByRole('button', { name: /share/i });
    await shareBtn.click();

    // The share action copies a URL — verify the clipboard has a URL
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('http');
    expect(clipboard).toContain('#doc=');
  });
});
