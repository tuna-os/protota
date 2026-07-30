import { test, expect } from '@playwright/test';

test.describe('Theme toggle (#5)', () => {
  test('toolbar has a theme toggle button', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /theme|dark|light/i });
    await expect(toggle).toBeVisible();
  });

  test('defaults to system preference', async ({ page }) => {
    await page.goto('/');
    // The document root should not have .theme-dark or .theme-light forced
    const app = page.locator('#root');
    // Adwaita widgets follow prefers-color-scheme
    // We test that the window element does not have a forced class
    // The app root just inherits from system
    await expect(app).not.toHaveClass(/theme-dark|theme-light/);
  });

  test('clicking toggle switches between light and dark on canvas', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /theme|dark|light/i });

    // Click to force dark theme
    await toggle.click();

    // The adw-window on the canvas should have .theme-dark
    const adwWindow = page.locator('adw-window').first();
    await expect(adwWindow).toHaveClass(/theme-dark/);

    // Click again to force light theme
    await toggle.click();

    await expect(adwWindow).toHaveClass(/theme-light/);
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /theme|dark|light/i });

    // Force dark
    await toggle.click();
    const adwWindow = page.locator('adw-window').first();
    await expect(adwWindow).toHaveClass(/theme-dark/);

    // Reload
    await page.reload();

    // Should still be dark (persisted in localStorage)
    const adwWindow2 = page.locator('adw-window').first();
    await expect(adwWindow2).toHaveClass(/theme-dark/);
  });

  test('all screens on the canvas switch theme together', async ({ page }) => {
    await page.goto('/');

    // Add a second screen
    await page.getByRole('button', { name: /new screen|add screen/i }).click();
    const dialog = page.locator('.protota-modal');
    await dialog.locator('input[type="text"]').fill('Second Screen');
    // Select a template (first option is pre-selected: Standard)
    await dialog.getByRole('button', { name: /create screen/i }).click();

    // Now force dark theme
    const toggle = page.getByRole('button', { name: /theme|dark|light/i });
    await toggle.click();

    // ALL adw-window elements should have .theme-dark
    const windows = page.locator('adw-window');
    const count = await windows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      await expect(windows.nth(i)).toHaveClass(/theme-dark/);
    }
  });
});
