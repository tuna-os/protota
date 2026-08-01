import { test, expect } from '@playwright/test';

// The Icon Library (GNOME "Icon Library" style): a browsable, searchable
// catalog of every symbolic icon in the installed @gjsify/adwaita-icons
// package, opened from the app-menu button (hamburger) on every viewport.
// (It left the menu bar with the Edit/View groups.)
test.describe('Icon library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  const openLibrary = async (page: import('@playwright/test').Page) => {
    await page.getByTestId('mobile-menu-button').click();
    await page.getByRole('menuitem', { name: /icon library/i }).click();
    await expect(page.getByTestId('icon-library')).toBeVisible({ timeout: 5000 });
  };

  test('opens from the View menu and lists the full catalog', async ({ page }) => {
    await openLibrary(page);

    // Far more icons than the old curated subset — the whole installed set.
    const items = page.locator('.protota-icon-library-item');
    expect(await items.count()).toBeGreaterThan(500);

    // Category filters from the package modules are present.
    await expect(
      page.getByTestId('icon-library').getByRole('button', { name: 'Status', exact: true }),
    ).toBeVisible();

    // Icons render through the runtime registry: a real mask, not a blank.
    const mask = await items.first().locator('.adw-icon').evaluate(
      (el) => window.getComputedStyle(el).maskImage,
    );
    expect(mask).not.toBe('none');
  });

  test('search narrows the grid to matching icons', async ({ page }) => {
    await openLibrary(page);

    await page.getByTestId('icon-library-search').fill('weather');

    const items = page.locator('.protota-icon-library-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(3);
    expect(count).toBeLessThan(30);
    for (const title of await items.evaluateAll((els) => els.map((el) => el.getAttribute('title')))) {
      expect(title).toContain('weather');
    }

    // Nonsense query shows the empty state, not stale results.
    await page.getByTestId('icon-library-search').fill('zzzznotanicon');
    await expect(items).toHaveCount(0);
  });

  test('clicking an icon copies its full name to the clipboard', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await openLibrary(page);

    await page.getByTestId('icon-library-search').fill('edit-undo');
    const item = page.locator('.protota-icon-library-item[title="edit-undo-symbolic"]');
    await item.click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('edit-undo-symbolic');

    // Brief copy feedback appears on the item and in the status line.
    await expect(item).toContainText('Copied');
    await expect(page.getByTestId('icon-library-status')).toContainText('edit-undo-symbolic');
  });

  test('clicking an icon applies it to a selected node with an icon property', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Add a status-page screen (its schema has an icon field) and select it —
    // same setup as the icon-picker spec.
    await page.getByRole('button', { name: /new screen|add screen/i }).click();
    await page.getByRole('radio', { name: /status/i }).click();
    await page.getByRole('button', { name: /create screen/i }).click();
    await page.locator('adw-status-page').last().click();
    await expect(page.locator('.protota-icon-trigger')).toBeVisible({ timeout: 5000 });

    await openLibrary(page);
    await page.getByTestId('icon-library-search').fill('weather-clear');
    await page.locator('.protota-icon-library-item[title="weather-clear-symbolic"]').click();
    await expect(page.getByTestId('icon-library-status')).toContainText('applied to selection');
    await page.getByRole('button', { name: 'Close' }).click();

    // The inspector's icon field now shows the applied icon.
    await expect(page.locator('.protota-icon-trigger')).toContainText('weather-clear');
  });

  test('appears in the mobile overflow menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('mobile-menu-button').click();
    await page.getByTestId('mobile-menu').getByRole('button', { name: 'Icon Library' }).click();
    await expect(page.getByTestId('icon-library')).toBeVisible({ timeout: 5000 });
  });
});
