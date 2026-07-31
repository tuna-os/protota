import { test, expect } from '@playwright/test';

/**
 * Layer-tree keyboard navigation (#79): the whole tree is reachable without
 * a mouse — arrows move selection, Left/Right collapse/expand, Enter renames,
 * Alt+Arrow reorders via moveNodeUp/moveNodeDown.
 */
test.describe('Layer tree keyboard navigation (#79)', () => {
  const rows = (page: import('@playwright/test').Page) => page.getByTestId('layer-row');
  const selectedRow = (page: import('@playwright/test').Page) =>
    page.locator('[data-testid="layer-row"].protota-tree-item--selected');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await expect(rows(page).first()).toBeVisible();
  });

  test('ArrowDown/ArrowUp move selection through the visible tree order', async ({ page }) => {
    await rows(page).first().click();
    await expect(selectedRow(page)).toContainText('window');

    await page.keyboard.press('ArrowDown');
    await expect(selectedRow(page)).toContainText('toolbar-view');

    await page.keyboard.press('ArrowDown');
    await expect(selectedRow(page)).toContainText('header-bar');

    await page.keyboard.press('ArrowUp');
    await expect(selectedRow(page)).toContainText('toolbar-view');
  });

  test('ArrowLeft collapses, ArrowRight expands', async ({ page }) => {
    const total = await rows(page).count();
    const root = rows(page).first();
    await root.click();
    await expect(root).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(root).toHaveAttribute('aria-expanded', 'false');
    await expect(rows(page)).toHaveCount(1);

    await page.keyboard.press('ArrowRight');
    await expect(root).toHaveAttribute('aria-expanded', 'true');
    await expect(rows(page)).toHaveCount(total);
  });

  test('ArrowRight on an expanded row moves to its first child; ArrowLeft on a leaf moves to the parent', async ({ page }) => {
    await rows(page).first().click();
    await page.keyboard.press('ArrowRight');
    await expect(selectedRow(page)).toContainText('toolbar-view');

    // Walk down to the window-title leaf, then Left goes to its header-bar parent.
    await page.keyboard.press('ArrowDown'); // header-bar
    await page.keyboard.press('ArrowDown'); // window-title (leaf)
    await expect(selectedRow(page)).toContainText('window-title');
    await page.keyboard.press('ArrowLeft');
    await expect(selectedRow(page)).toContainText('header-bar');
  });

  test('Enter begins inline rename and commits the new title', async ({ page }) => {
    await rows(page).first().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // header-bar
    await page.keyboard.press('Enter');

    const input = page.getByTestId('layer-rename-input');
    await expect(input).toBeVisible();
    await input.fill('Renamed Header');
    await page.keyboard.press('Enter');

    await expect(input).toHaveCount(0);
    await expect(selectedRow(page)).toContainText('header-bar (Renamed Header)');
    // Focus returns to the row so navigation continues without a mouse.
    await expect(selectedRow(page)).toBeFocused();
  });

  test('Escape cancels a rename without applying it', async ({ page }) => {
    await rows(page).first().click();
    await page.keyboard.press('ArrowDown'); // toolbar-view
    const before = await selectedRow(page).textContent();
    await page.keyboard.press('Enter');
    const input = page.getByTestId('layer-rename-input');
    await input.fill('Discarded');
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(selectedRow(page)).toHaveText(before ?? '');
    // Escape inside the rename input must not bubble into global deselect.
    await expect(selectedRow(page)).toHaveCount(1);
  });

  test('Alt+ArrowDown/Alt+ArrowUp reorder the selected node among its siblings', async ({ page }) => {
    // header-bar and the content box are siblings under toolbar-view.
    await rows(page).first().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // header-bar
    await expect(selectedRow(page)).toContainText('header-bar');

    await page.keyboard.press('Alt+ArrowDown');
    // toolbar-view's children are now [box, header-bar]: the box subtree
    // renders before header-bar, and selection stays on the moved node.
    await expect(rows(page).nth(2)).toContainText('box');
    await expect(selectedRow(page)).toContainText('header-bar');

    await page.keyboard.press('Alt+ArrowUp');
    await expect(rows(page).nth(2)).toContainText('header-bar');
    await expect(selectedRow(page)).toContainText('header-bar');
  });

  test('plain arrows in the tree do not trigger global Ctrl+Arrow reordering', async ({ page }) => {
    await rows(page).first().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // header-bar row selected
    // If ArrowDown leaked into the global handler as a reorder, header-bar
    // would swap below the content box. It must only move the selection.
    await expect(rows(page).nth(2)).toContainText('header-bar');
  });
});
