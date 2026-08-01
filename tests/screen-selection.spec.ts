import { test, expect, type Page } from '@playwright/test';

/**
 * Screen selection and deletion (#138): clicking the screen title on the
 * canvas or the screen row in the Layers panel selects the whole screen;
 * Delete/Backspace removes it (one undo step, edges included); remaining
 * screens auto-fill the space; the last screen refuses with a visible
 * reason.
 */

const screens = (page: Page) => page.locator('[data-protota-flow-screen]');
const screenTitle = (page: Page, nth = 0) => page.locator('[data-testid^="screen-title-"]').nth(nth);
const selectedFrame = (page: Page) => page.locator('.protota-screen-frame--selected');
const screenRows = (page: Page) => page.getByTestId('screen-row');

async function addScreen(page: Page, title: string) {
  await page.getByRole('button', { name: /new screen|add screen/i }).click();
  await page.getByRole('textbox').first().fill(title);
  await page.getByRole('button', { name: /create/i }).click();
  await expect(screens(page)).toHaveCount(2);
}

test.describe('Screen selection and deletion (#138)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('clicking the screen title selects the whole screen, distinct from node selection', async ({ page }) => {
    // Select a node first: screen selection must replace it.
    await page.locator('.protota-canvas adw-header-bar').first().click();
    await expect(page.locator('.selected-outline').first()).toBeVisible();

    await screenTitle(page).click();
    await expect(selectedFrame(page)).toHaveCount(1);
    // Node selection cleared — the global Delete shortcut has nothing to act on.
    await expect(page.locator('.selected-outline')).toHaveCount(0);
    // The screen row in the Layers panel reflects the selection too.
    await expect(screenRows(page).first()).toHaveClass(/protota-tree-item--selected/);
  });

  test('Delete removes the selected screen and remaining screens auto-fill the space', async ({ page }) => {
    await addScreen(page, 'Second');
    const secondId = await screens(page).nth(1).getAttribute('data-protota-flow-screen');
    const before = (await page.locator(`[data-protota-flow-screen="${secondId}"]`).boundingBox())!;

    await screenTitle(page, 0).click();
    await expect(selectedFrame(page)).toHaveCount(1);
    await page.keyboard.press('Delete');

    await expect(screens(page)).toHaveCount(1);
    await expect(screens(page).first()).toHaveAttribute('data-protota-flow-screen', secondId!);
    // No stored x/y: the flex row closes the gap, so the survivor moved left.
    await expect
      .poll(async () => (await page.locator(`[data-protota-flow-screen="${secondId}"]`).boundingBox())!.x)
      .toBeLessThan(before.x);
  });

  test('screen row in the Layers panel selects; Delete removes; undo restores fully', async ({ page }) => {
    await addScreen(page, 'Doomed');
    await expect(screenRows(page)).toHaveCount(2);

    await screenRows(page).nth(1).click();
    await expect(screenRows(page).nth(1)).toHaveClass(/protota-tree-item--selected/);

    await page.keyboard.press('Delete');
    await expect(screens(page)).toHaveCount(1);
    await expect(screenRows(page)).toHaveCount(1);

    // Undo restores the screen — nodes and title included — in one step.
    await page.keyboard.press('Control+z');
    await expect(screens(page)).toHaveCount(2);
    await expect(screenRows(page).nth(1)).toContainText('Doomed');
    await expect(page.locator('adw-window')).toHaveCount(2);
  });

  test('arrow keys reach screen rows; Enter renames the screen', async ({ page }) => {
    // ArrowUp from the root widget row lands on the screen row above it.
    await page.getByTestId('layer-row').first().click();
    await page.keyboard.press('ArrowUp');
    await expect(screenRows(page).first()).toHaveClass(/protota-tree-item--selected/);

    await page.keyboard.press('Enter');
    const input = page.getByTestId('screen-rename-input');
    await expect(input).toBeVisible();
    await input.fill('Renamed Screen');
    await page.keyboard.press('Enter');
    await expect(input).toHaveCount(0);
    await expect(screenRows(page).first()).toContainText('Renamed Screen');
    await expect(screenTitle(page)).toContainText('Renamed Screen');
  });

  test('deleting the last screen refuses with a visible reason', async ({ page }) => {
    await screenTitle(page).click();
    await expect(selectedFrame(page)).toHaveCount(1);
    await page.keyboard.press('Delete');

    await expect(page.getByTestId('screen-delete-notice')).toBeVisible();
    await expect(page.getByTestId('screen-delete-notice')).toContainText(/last screen/i);
    await expect(screens(page)).toHaveCount(1);
  });

  test('Escape and empty-canvas click clear the screen selection', async ({ page }) => {
    await screenTitle(page).click();
    await expect(selectedFrame(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(selectedFrame(page)).toHaveCount(0);

    await screenTitle(page).click();
    await expect(selectedFrame(page)).toHaveCount(1);
    await page.locator('.protota-canvas').click({ position: { x: 30, y: 30 } });
    await expect(selectedFrame(page)).toHaveCount(0);
  });
});
