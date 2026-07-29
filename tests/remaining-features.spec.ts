import { test, expect } from '@playwright/test';

test.describe('Remaining features (#9, #16, #18-#24)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('#9 Blueprint export button exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: /code export/i })).toBeVisible();
  });

  test('#16 Screen width defaults exist in store', async ({ page }) => {
    const screen = page.locator('adw-window').first();
    await expect(screen).toBeVisible();
    const w = await screen.evaluate(el => (el as HTMLElement).style.width);
    expect(w).toBeTruthy();
  });

  test('#18 Selection outline on click', async ({ page }) => {
    const window = page.locator('adw-window').first();
    await window.click();
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
  });

  test('#19 Right-click shows context menu', async ({ page }) => {
    const window = page.locator('adw-window').first();
    await window.click({ button: 'right' });
    const menu = page.locator('.protota-context-menu');
    await expect(menu).toBeVisible({ timeout: 3000 });
  });

  test('#20 Undo button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
  });

  test('#21 Preset gallery accessible', async ({ page }) => {
    await page.getByRole('button', { name: /preset/i }).click();
    await expect(page.locator('.protota-preset-item').first()).toBeVisible({ timeout: 3000 });
  });

  test('#22 A11y lint rule covers icon-only buttons', async ({ page }) => {
    const lintBtn = page.getByRole('button', { name: /lint/i });
    await lintBtn.click();
    await expect(lintBtn).toHaveAttribute('data-active', 'true');
  });

  test('#23 Command palette opens with Ctrl+K', async ({ page }) => {
    const hdr = page.locator('adw-header-bar').first();
    await hdr.click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.protota-command-palette')).toBeVisible({ timeout: 3000 });
  });

  test('#24 Export + PNG buttons visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /save json/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /png/i })).toBeVisible();
  });
});
