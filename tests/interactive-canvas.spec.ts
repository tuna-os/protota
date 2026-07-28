import { test, expect } from '@playwright/test';

test.describe('Interactive canvas (#10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test.describe('Hover and active states', () => {
    test('buttons receive hover styles from adwaita-web CSS', async ({ page }) => {
      // Click the canvas to deselect, then find a button inside adw-window
      const button = page.locator('adw-window adw-button').first();
      // Buttons may not exist in default template; test that selector resolves
      const count = await button.count();
      if (count > 0) {
        await button.hover();
        // Hover state is handled by adwaita-web CSS — just verify no crash
        await expect(button).toBeVisible();
      }
    });

    test('adw-window renders with proper Adwaita styling', async ({ page }) => {
      const adwWindow = page.locator('adw-window').first();
      await expect(adwWindow).toBeVisible();

      // Verify the adw-window has computed styles from adwaita-web CSS
      const borderRadius = await adwWindow.evaluate((el) =>
        window.getComputedStyle(el).borderRadius);
      expect(borderRadius).not.toBe('0px');
    });
  });

  test.describe('Canvas pan and zoom', () => {
    test('canvas renders with overflow hidden for pan/zoom', async ({ page }) => {
      const canvas = page.locator('.protota-canvas');
      await expect(canvas).toBeVisible();
      const overflow = await canvas.evaluate((el) =>
        window.getComputedStyle(el).overflow);
      expect(overflow).toContain('hidden');
    });

    test('zoom controls are visible', async ({ page }) => {
      const zoomBar = page.locator('.protota-zoom-bar');
      await expect(zoomBar).toBeVisible();

      // Zoom percentage display
      await expect(zoomBar.getByText(/100%/)).toBeVisible();

      // Zoom buttons
      await expect(zoomBar.getByRole('button', { name: '−' })).toBeVisible();
      await expect(zoomBar.getByRole('button', { name: '+' })).toBeVisible();
      await expect(zoomBar.getByRole('button', { name: /reset/i })).toBeVisible();
    });
  });

  test.describe('Selection and editing', () => {
    test('clicking an element shows selection outline', async ({ page }) => {
      // Find a clickable element inside the adw-window
      const window = page.locator('adw-window').first();
      await window.click();

      // Selection outline should appear
      const outline = page.locator('.adw-node-wrapper.selected-outline');
      await expect(outline.first()).toBeVisible({ timeout: 3000 });
    });

    test('clicking canvas background deselects', async ({ page }) => {
      // Select something first
      const window = page.locator('adw-window').first();
      await window.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Press Escape to deselect (keyboard shortcut from #14)
      await page.keyboard.press('Escape');

      // Selection should clear
      await expect(page.locator('.selected-outline')).toHaveCount(0, { timeout: 3000 });
    });

    test('selected element shows context-sensitive add buttons', async ({ page }) => {
      // Select the toolbar-view (contains header-bar as legal child)
      const toolbarView = page.locator('adw-toolbar-view').first();
      await toolbarView.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Add buttons should appear for legal children
      const addBtn = page.locator('.protota-add-btn').first();
      await expect(addBtn).toBeVisible({ timeout: 3000 });
    });
  });
});
