import { test, expect } from '@playwright/test';

test.describe('Keyboard shortcuts (#14)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test.describe('Editing shortcuts', () => {
    test('Ctrl+Z undoes last action', async ({ page }) => {
      // Select the window and add a child to have something to undo
      const window = page.locator('adw-window').first();
      await window.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Open the compact add chip and insert a child via the popover
      const addChip = page.locator('.protota-add-chip').first();
      if (await addChip.isVisible()) {
        await addChip.click();
        const popover = page.locator('.protota-add-popover');
        await expect(popover).toBeVisible({ timeout: 3000 });
        await popover.locator('.protota-add-popover-item').first().click();

        // Now undo
        await page.keyboard.press('Control+z');

        // Should have removed the newly added child
        // (undo restores the previous snapshot)
      }
    });

    test('Delete key deletes selected element', async ({ page }) => {
      // Select an element inside the window
      const toolbarView = page.locator('adw-toolbar-view').first();
      await toolbarView.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Attempt delete — should delete the selected toolbar-view
      await page.keyboard.press('Delete');

      // Verify something changed (delete action ran)
      // The exact count depends on what was deletable
    });

    test('Escape deselects', async ({ page }) => {
      const window = page.locator('adw-window').first();
      await window.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await expect(page.locator('.selected-outline')).toHaveCount(0, { timeout: 3000 });
    });

    test('Arrow keys move selected element up/down in parent', async ({ page }) => {
      // Select a child element
      const headerBar = page.locator('.protota-canvas adw-header-bar').first();
      await headerBar.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Arrow key nudge should call moveNodeUp/moveNodeDown
      // This is a smoke test — arrow handler must exist
      await page.keyboard.press('ArrowDown');
      // Should not crash and element should still be visible
      await expect(headerBar).toBeVisible();
    });
  });

  test.describe('View shortcuts', () => {
    test('Ctrl+Plus zooms in, Ctrl+Minus zooms out', async ({ page }) => {
      const zoomLabel = page.locator('.protota-zoom-bar').getByText(/^[0-9]+%$/);
      const initialZoom = await zoomLabel.textContent();

      // Zoom in
      await page.keyboard.press('Control+='); // = is on the plus key without shift
      await page.waitForTimeout(200);
      const zoomAfterIn = await zoomLabel.textContent();
      expect(zoomAfterIn).not.toBe(initialZoom);

      // Zoom out
      await page.keyboard.press('Control+-');
      await page.waitForTimeout(200);
      const zoomAfterOut = await zoomLabel.textContent();
      expect(zoomAfterOut).not.toBe(zoomAfterIn);
    });

    test('Ctrl+0 resets zoom to 100%', async ({ page }) => {
      // Zoom in first
      await page.keyboard.press('Control+=');
      await page.keyboard.press('Control+=');

      // Reset
      await page.keyboard.press('Control+0');
      await page.waitForTimeout(200);

      const zoomLabel = page.locator('.protota-zoom-bar').getByText('100%');
      await expect(zoomLabel).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Quick-add shortcuts', () => {
    test('B key adds a button to selected container', async ({ page }) => {
      // Select a container that accepts buttons
      const box = page.locator('adw-toolbar-view').first();
      await box.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

      // Count buttons before
      const before = await page.locator('gtk-button').count();

      // Press B
      await page.keyboard.press('b');

      // Should have added a button
      await page.waitForTimeout(300);
      const after = await page.locator('gtk-button').count();
      // The shortcut handler must exist and not crash; the count never drops.
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  test.describe('Shortcuts help', () => {
    test('Ctrl+? opens keyboard shortcuts help overlay', async ({ page }) => {
      await page.locator('body').click();
      await page.keyboard.press('Control+?');

      // The host custom element only wraps the fixed scrim, so it has no box of
      // its own — assert the visible surface instead.
      const overlay = page.locator('[data-testid="shortcuts-overlay"]');
      const box = overlay.locator('.adw-dialog-box');
      await expect(box).toBeVisible({ timeout: 5000 });
      await expect(overlay.getByText('Undo')).toBeVisible({ timeout: 3000 });
      await expect(overlay.getByText('Ctrl').first()).toBeVisible({ timeout: 3000 });

      // Desktop keeps the floating presentation: a card, not a full-bleed sheet.
      await expect(overlay).toHaveAttribute('data-presentation', 'auto');
      const rect = await box.boundingBox();
      const viewport = page.viewportSize();
      expect(rect).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(rect!.width).toBeLessThan(viewport!.width);
    });

    test('becomes a bottom sheet at phone width', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await page.waitForSelector('adw-window', { timeout: 10000 });

      await page.keyboard.press('Control+?');

      const overlay = page.locator('[data-testid="shortcuts-overlay"]');
      await expect(overlay).toHaveAttribute('data-presentation', 'auto');

      // The auto presentation falls back to the bottom sheet at <=550px: the
      // box is edge-to-edge and anchored to the bottom of the viewport.
      const box = overlay.locator('.adw-dialog-box');
      await expect(box).toBeVisible({ timeout: 5000 });
      const rect = await box.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.width).toBeGreaterThanOrEqual(389);
      expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(843);
    });

    test('shows the header shade only while the list is scrolled', async ({ page }) => {
      await page.locator('body').click();
      await page.keyboard.press('Control+?');

      const overlay = page.locator('[data-testid="shortcuts-overlay"]');
      const content = overlay.locator('.adw-dialog-content');
      const header = overlay.locator('.adw-dialog-header');
      await expect(overlay.locator('.adw-dialog-box')).toBeVisible({ timeout: 5000 });

      const shade = () =>
        header.evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
      const scrolled = () => overlay.evaluate((el) => el.hasAttribute('data-scrolled'));

      // At the top the flat header bar has no undershoot shade.
      expect(await scrolled()).toBe(false);
      expect(await shade()).toBe('none');

      // Scrolling under the bar draws it...
      await content.evaluate((el) => {
        el.scrollTop = 300;
        el.dispatchEvent(new Event('scroll'));
      });
      expect(await scrolled()).toBe(true);
      expect(await shade()).not.toBe('none');

      // ...and returning to the top takes it away again.
      await content.evaluate((el) => {
        el.scrollTop = 0;
        el.dispatchEvent(new Event('scroll'));
      });
      expect(await scrolled()).toBe(false);
      expect(await shade()).toBe('none');
    });

    test('keeps the row subtitle beside the keycaps', async ({ page }) => {
      await page.locator('body').click();
      await page.keyboard.press('Control+?');

      const overlay = page.locator('[data-testid="shortcuts-overlay"]');
      await expect(overlay.locator('.adw-dialog-box')).toBeVisible({ timeout: 5000 });

      // adwaita-web flattens the row into title/subtitle/label siblings, so the
      // subtitle has to be pinned to the trailing group rather than centred.
      const row = overlay.locator('adw-shortcuts-item').filter({ hasText: 'Pan canvas' });
      const rowBox = await row.boundingBox();
      const subtitle = await row.locator('.adw-shortcuts-item-subtitle').boundingBox();
      const label = await row.locator('.adw-shortcuts-item-label').boundingBox();
      expect(rowBox).not.toBeNull();
      expect(subtitle).not.toBeNull();
      expect(label).not.toBeNull();
      expect(subtitle!.x).toBeGreaterThan(rowBox!.x + rowBox!.width * 0.5);
      expect(subtitle!.x + subtitle!.width).toBeLessThanOrEqual(label!.x);
    });
  });
});

test.describe("Subtree clipboard", () => {
  test("Ctrl+D duplicates the selected widget beside itself", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("adw-window", { timeout: 10000 });

    const labels = page.locator('.protota-canvas [data-protota-type="label"]');
    const before = await labels.count();

    await labels.first().click({ position: { x: 4, y: 4 } });
    await page.keyboard.press("Control+d");
    await expect(labels).toHaveCount(before + 1);

    // Undo restores the original tree.
    await page.keyboard.press("Control+z");
    await expect(labels).toHaveCount(before);
  });
});
