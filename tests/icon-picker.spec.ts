import { test, expect } from '@playwright/test';

test.describe('Icon picker (#13)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test.describe('Icon property fields show picker trigger', () => {
    test('status-page icon field opens visual picker', async ({ page }) => {
      // Add a status-page screen which has an icon property
      await page.getByRole('button', { name: /new screen|add screen/i }).click();
      await page.getByRole('radio', { name: /status/i }).click();
      await page.getByRole('button', { name: /create screen/i }).click();

      // Find the new status-page and select it
      const statusPage = page.locator('adw-status-page').last();
      await statusPage.click();

      // Find the icon field in the inspector — should be a clickable trigger
      const iconTrigger = page.locator('.protota-icon-trigger');
      await expect(iconTrigger).toBeVisible({ timeout: 5000 });
    });

    test('clicking icon trigger opens picker popover', async ({ page }) => {
      // Same setup — add a status-page
      await page.getByRole('button', { name: /new screen|add screen/i }).click();
      await page.getByRole('radio', { name: /status/i }).click();
      await page.getByRole('button', { name: /create screen/i }).click();

      const statusPage = page.locator('adw-status-page').last();
      await statusPage.click();

      const iconTrigger = page.locator('.protota-icon-trigger');
      await expect(iconTrigger).toBeVisible({ timeout: 5000 });

      // Click to open
      await iconTrigger.click();

      const picker = page.locator('.protota-icon-picker');
      await expect(picker).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Icon search and selection', () => {
    test('search filters icons by name', async ({ page }) => {
      // Setup: add status-page, open icon picker
      await page.getByRole('button', { name: /new screen|add screen/i }).click();
      await page.getByRole('radio', { name: /status/i }).click();
      await page.getByRole('button', { name: /create screen/i }).click();
      const statusPage = page.locator('adw-status-page').last();
      await statusPage.click();
      const iconTrigger = page.locator('.protota-icon-trigger');
      await iconTrigger.click();

      // Search for "search" icons
      const searchInput = page.locator('.protota-icon-picker-search');
      await searchInput.fill('search');

      // Should show system-search-symbolic
      const iconItem = page.locator('.protota-icon-item').filter({ hasText: 'search' });
      await expect(iconItem.first()).toBeVisible({ timeout: 3000 });

      // Should NOT show unrelated icons
      const documentIcon = page.locator('.protota-icon-item').filter({ hasText: 'document-open' });
      await expect(documentIcon).toHaveCount(0);
    });

    test('clicking an icon selects it and closes picker', async ({ page }) => {
      await page.getByRole('button', { name: /new screen|add screen/i }).click();
      await page.getByRole('radio', { name: /status/i }).click();
      await page.getByRole('button', { name: /create screen/i }).click();
      const statusPage = page.locator('adw-status-page').last();
      await statusPage.click();
      const iconTrigger = page.locator('.protota-icon-trigger');
      await iconTrigger.click();

      // Select the first icon
      const firstIcon = page.locator('.protota-icon-item').first();
      const iconName = await firstIcon.textContent();
      await firstIcon.click();

      // Picker should close
      await expect(page.locator('.protota-icon-picker')).not.toBeVisible({ timeout: 3000 });

      // The trigger should show the selected icon name
      if (iconName) {
        await expect(iconTrigger).toContainText(iconName.trim(), { timeout: 3000 });
      }
    });
  });

  test.describe('Icon rendering', () => {
    test('picker icons render using adwaita-web CSS mask-image', async ({ page }) => {
      await page.getByRole('button', { name: /new screen|add screen/i }).click();
      await page.getByRole('radio', { name: /status/i }).click();
      await page.getByRole('button', { name: /create screen/i }).click();
      const statusPage = page.locator('adw-status-page').last();
      await statusPage.click();
      const iconTrigger = page.locator('.protota-icon-trigger');
      await iconTrigger.click();

      // Each icon in the picker should have the adw-icon class
      const iconElements = page.locator('.protota-icon-item .adw-icon');
      const count = await iconElements.count();
      expect(count).toBeGreaterThan(0);

      // First icon should have a computed mask-image
      if (count > 0) {
        const maskImage = await iconElements.first().evaluate((el) =>
          window.getComputedStyle(el).maskImage);
        expect(maskImage).not.toBe('none');
      }
    });
  });
});
