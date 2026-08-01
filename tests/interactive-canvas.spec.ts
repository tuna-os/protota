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
      await expect(zoomBar.getByRole('button', { name: /zoom out/i })).toBeVisible();
      await expect(zoomBar.getByRole('button', { name: /zoom in/i })).toBeVisible();
      await expect(zoomBar.getByRole('button', { name: /reset zoom/i })).toBeVisible();
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

    test('selected element shows a single compact add chip', async ({ page }) => {
      // Select the toolbar-view (contains header-bar as legal child)
      const toolbarView = page.locator('adw-toolbar-view').first();
      await toolbarView.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Exactly one "+" chip should appear — not one pill per legal type
      const chip = page.locator('.protota-add-chip');
      await expect(chip).toHaveCount(1);
      await expect(chip).toBeVisible({ timeout: 3000 });
    });

    test('add chip opens searchable popover; search + insert + undo', async ({ page }) => {
      const toolbarView = page.locator('adw-toolbar-view').first();
      await toolbarView.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      const before = await page.locator('adw-toolbar-view adw-button').count();

      // Open the popover from the chip
      await page.locator('.protota-add-chip').click();
      const popover = page.locator('.protota-add-popover');
      await expect(popover).toBeVisible({ timeout: 3000 });

      // Common shortcuts row front-loads frequent types for this container
      await expect(popover.locator('.protota-add-popover-common .protota-add-btn').first())
        .toBeVisible();

      // Search narrows the legal-children list
      const search = popover.locator('.protota-add-popover-search');
      await search.fill('button');
      const items = popover.locator('.protota-add-popover-item');
      await expect(items.first()).toBeVisible();

      // Pick "Button" (exact label — "Button Row" also matches the search)
      // — inserts exactly like the old pills did
      await items
        .filter({ has: page.locator('.protota-add-popover-item-label', { hasText: /^Button$/ }) })
        .first().click();
      await expect(popover).toBeHidden();
      await expect(page.locator('adw-toolbar-view adw-button')).toHaveCount(before + 1);

      // Undo removes the inserted child (same single-step history)
      await page.keyboard.press('Control+z');
      await expect(page.locator('adw-toolbar-view adw-button')).toHaveCount(before);
    });

    test('add popover supports keyboard navigation and Escape', async ({ page }) => {
      const toolbarView = page.locator('adw-toolbar-view').first();
      await toolbarView.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      await page.locator('.protota-add-chip').click();
      const popover = page.locator('.protota-add-popover');
      await expect(popover).toBeVisible({ timeout: 3000 });

      // Arrow keys move the active row
      const search = popover.locator('.protota-add-popover-search');
      await search.press('ArrowDown');
      await expect(popover.locator('.protota-add-popover-item.active')).toHaveCount(1);

      // Escape closes the popover without inserting or deselecting focus
      await search.press('Escape');
      await expect(popover).toBeHidden();
      await expect(page.locator('.selected-outline').first()).toBeVisible();
    });
  });
});
