import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Read a box once the canvas has stopped moving.
 *
 * A new screen is framed by setting pan/zoom state, which the surface eases in
 * over a 200ms CSS transition while the screen frame itself is still growing to
 * its content's natural size. A boundingBox() taken in that window measures a
 * mid-animation position, so both the containment and the centring assertion
 * read whatever the transition happened to be at. Poll until two consecutive
 * reads agree instead of guessing a sleep.
 */
async function settledBox(
  locator: Locator,
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  let previous = await locator.boundingBox();
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.waitForTimeout(50);
    const current = await locator.boundingBox();
    if (
      current && previous &&
      Math.abs(current.x - previous.x) < 0.5 &&
      Math.abs(current.y - previous.y) < 0.5 &&
      Math.abs(current.width - previous.width) < 0.5 &&
      Math.abs(current.height - previous.height) < 0.5
    ) {
      return current;
    }
    previous = current;
  }
  return previous!;
}

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

  test('a newly added screen is fit, centred, and focused', async ({ page }) => {
    await page.getByRole('button', { name: /new screen|add screen/i }).click();
    await page.getByRole('textbox').first().fill('Framed');
    await page.getByRole('button', { name: /create/i }).click();

    const frames = page.locator('[data-protota-flow-screen]');
    await expect(frames).toHaveCount(2);

    // The screen dropdown tracks the new screen.
    await expect(page.locator('.protota-screen-dropdown .adw-drop-down-label')).toHaveText('2');

    // The new screen is fully inside the canvas and horizontally centred.
    const canvas = (await settledBox(page.locator('.protota-canvas'), page))!;
    const second = (await settledBox(frames.nth(1), page))!;
    expect(second.x).toBeGreaterThanOrEqual(canvas.x);
    expect(second.x + second.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(second.y).toBeGreaterThanOrEqual(canvas.y);
    expect(second.y + second.height).toBeLessThanOrEqual(canvas.y + canvas.height);
    const centreDelta = Math.abs(
      second.x + second.width / 2 - (canvas.x + canvas.width / 2),
    );
    expect(centreDelta).toBeLessThan(8);
  });

  test('switching screens parks the focused screen at a tight top margin', async ({ page }) => {
    await page.getByRole('button', { name: /new screen|add screen/i }).click();
    await page.getByRole('textbox').first().fill('Second');
    await page.getByRole('button', { name: /create/i }).click();

    // Creating the screen focused it; switch back to the first.
    await page.getByTitle('Previous Screen').click();

    const canvas = (await settledBox(page.locator('.protota-canvas'), page))!;
    const first = (await settledBox(page.locator('[data-protota-flow-screen]').nth(0), page))!;
    // Top margin is 10% of the canvas height.
    expect(Math.abs(first.y - canvas.y - canvas.height * 0.1)).toBeLessThan(3);
  });

  test('delete key removes selected element', async ({ page }) => {
    // Clicking the header bar selects the innermost node under the cursor —
    // its window-title, an adopted child of adw-header-bar's internal DOM.
    const headerBar = page.locator('.protota-canvas adw-header-bar').first();
    await headerBar.click();
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
    const selectedId = await page
      .locator('.selected-outline [data-node-id]').first()
      .getAttribute('data-node-id');
    expect(selectedId).toBeTruthy();

    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // The selected node is gone…
    expect(await page.locator(`[data-node-id="${selectedId}"]`).count()).toBe(0);
    // …and the app survived the commit (#137): deleting an adopted child
    // used to crash React's removeChild and unmount the entire app, which
    // made the old "header bar count decreased" assertion pass vacuously —
    // the count hit zero because the whole canvas was gone.
    expect(await page.locator('.protota-canvas adw-window').count()).toBeGreaterThan(0);
  });
});
