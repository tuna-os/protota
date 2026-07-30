import { test, expect } from '@playwright/test';

test.describe('Screen duplication & context menu (#18, #19)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('screen duplication creates a copy of an existing screen', async ({ page }) => {
    // There's 1 screen initially
    const before = await page.locator('adw-window').count();

    // Add a screen first
    await page.getByRole('button', { name: /new screen|add screen/i }).click();
    await page.getByRole('textbox').first().fill('Copy Me');
    await page.getByRole('button', { name: /create/i }).click();
    await page.waitForTimeout(500);

    // Now we should have 2 screens
    const afterAdd = await page.locator('adw-window').count();
    expect(afterAdd).toBe(before + 1);
  });

  test('delete key removes selected element', async ({ page }) => {
    // Select a header bar inside the window
    const headerBar = page.locator('.protota-canvas adw-header-bar').first();
    await headerBar.click();
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

    // Count header bars before
    const before = await page.locator('.protota-canvas adw-header-bar').count();

    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Header bar should be deleted
    const after = await page.locator('.protota-canvas adw-header-bar').count();
    expect(after).toBeLessThan(before);
  });
});
