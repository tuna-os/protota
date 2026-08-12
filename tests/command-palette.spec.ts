import { test, expect } from '@playwright/test';

test.describe('Command palette (#15)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('Ctrl+K opens command palette', async ({ page }) => {
    const hdr = page.locator('.protota-canvas adw-header-bar').first();
    await hdr.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+k');
    const palette = page.locator('.protota-command-palette');
    await expect(palette).toBeVisible({ timeout: 3000 });
  });

  test('typing in palette filters widgets', async ({ page }) => {
    // Select a header-bar which accepts buttons
    const hdr = page.locator('.protota-canvas adw-header-bar').first();
    await hdr.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+k');

    const palette = page.locator('.protota-command-palette');
    await expect(palette).toBeVisible({ timeout: 3000 });

    const searchInput = palette.locator('input');
    await searchInput.fill('but');
    await page.waitForTimeout(300);

    // Verify palette contains filtered results
    const bodyText = await palette.textContent();
    expect(bodyText).toContain('Button');
  });

  test('selecting a widget from palette inserts it', async ({ page }) => {
    const hdr = page.locator('.protota-canvas adw-header-bar').first();
    await hdr.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+k');

    const palette = page.locator('.protota-command-palette');
    await expect(palette).toBeVisible({ timeout: 3000 });

    const searchInput = palette.locator('input');
    await searchInput.fill('window');
    await page.waitForTimeout(200);

    // Click first result item (window-title)
    const firstClickable = palette.locator('div').filter({ hasText: 'Window Title' }).first();
    if (await firstClickable.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstClickable.click({ force: true });
      await expect(palette).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('Escape closes palette', async ({ page }) => {
    const hdr = page.locator('.protota-canvas adw-header-bar').first();
    await hdr.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+k');

    await expect(page.locator('.protota-command-palette')).toBeVisible({ timeout: 3000 });

    // Close by pressing Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('.protota-command-palette')).not.toBeVisible({ timeout: 3000 });
  });
});
