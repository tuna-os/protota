import { test, expect } from '@playwright/test';

test.describe('Shareable links (#25)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('Share action exists in the Export menu', async ({ page }) => {
    // The share/export header buttons consolidated into the Export menu
    // (#108 header reorg); Share URL is its last item.
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /share url/i })).toBeVisible();
  });

  test('sharing copies a URL to clipboard', async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('menuitem', { name: /share url/i }).click();

    // The share action copies a URL — verify the clipboard has a URL
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('http');
    expect(clipboard).toContain('#doc=');
  });
});
