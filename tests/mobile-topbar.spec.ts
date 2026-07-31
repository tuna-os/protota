import { test, expect } from '@playwright/test';

// Issue #99: on mobile-sized viewports the top bar collapses into a compact
// header — app identity plus a hamburger overflow menu — instead of the
// desktop menu bar and direct-access buttons overflowing the screen.
test.describe('Mobile topbar (#99)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders a compact topbar with a hamburger menu', async ({ page }) => {
    await page.goto('/');

    // Header bar renders and stays within the viewport width. (The canvas
    // mockups contain their own adw-header-bar, so target the app's.)
    const header = page.locator('adw-header-bar[slot="top"]');
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(390);

    // Hamburger is visible; the desktop menu bar and direct-access buttons
    // are collapsed away.
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'File', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'HIG Lint', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /save json/i })).toBeHidden();

    // The page itself must not scroll horizontally.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test('hamburger opens an overflow menu containing the collapsed actions', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('mobile-menu-button').click();
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();

    // Collapsed actions are reachable from the overflow menu. (Accessible
    // names include keyboard shortcuts, e.g. "New Screen Ctrl+N".)
    await expect(menu.getByRole('button', { name: /new screen/i })).toBeVisible();
    await expect(menu.getByRole('button', { name: /load preset/i })).toBeVisible();
    await expect(menu.getByRole('button', { name: /export as png/i })).toBeVisible();
    await expect(menu.getByRole('button', { name: /share url/i })).toBeVisible();
    await expect(menu.getByRole('button', { name: /hig lint/i })).toBeVisible();

    // The menu itself fits the viewport.
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(390);

    // An action in the overflow menu works: New Screen opens its modal.
    await menu.getByRole('button', { name: /new screen/i }).click();
    await expect(page.locator('.protota-modal')).toBeVisible();
  });

  test('desktop viewport keeps the full menu bar and hides the hamburger', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'File', exact: true })).toBeVisible();
    await expect(page.getByTestId('mobile-menu-button')).toBeHidden();
  });
});
