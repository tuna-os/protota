import { test, expect } from '@playwright/test';

// Issue #99: on mobile-sized viewports the top bar collapses into a compact
// header — labelled Open/Export menu buttons, the Flows/Diagnostics toggles,
// and an app-menu button at the header end — instead of the desktop menu bar
// and direct-access buttons overflowing the screen. The labelled Open/Export
// menu buttons, the Flows/Diagnostics toggles and the app-menu button render
// on every viewport; the app-menu holds the same entries everywhere (a
// 3-circle theme switcher first, then Icon Library + Show Shortcuts). The
// mobile-only "Actions" overflow group is gone — New Screen lives in the
// bottom bar.
test.describe('Mobile topbar (#99)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders a compact topbar with a hamburger menu', async ({ page }) => {
    await page.goto('/');

    // Header bar renders and stays within the viewport width. (The canvas
    // mockups contain their own adw-header-bar, so target the app's.)
    const header = page.getByTestId('app-header-bar');
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(390);

    // Hamburger, labelled Open/Export menus and the Flows/Diagnostics
    // toggles render on mobile too; the old menu bar is gone.
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    await expect(page.getByTestId('mobile-menu-button').getByRole('button')).toHaveAttribute('title', 'Menu');
    await expect(header.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await expect(header.getByRole('button', { name: /flow/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /hig lint/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /save json/i })).toHaveCount(0);

    // The page itself must not scroll horizontally.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test('hamburger opens the app-menu with the theme switcher and app items', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('mobile-menu-button').click();
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();

    // The app-menu holds the same entries on mobile as on desktop: the theme
    // switcher first, then the app items. The old mobile-only Actions group
    // (New Screen) is gone — New Screen lives in the bottom bar. (Accessible
    // names include keyboard shortcuts, e.g. "Show Shortcuts ?"; the
    // adw-menu-button renders items as role=menuitem.) Open/Export are
    // labelled header buttons on every viewport, so Load Preset / Export /
    // Share URL are not in the app-menu.
    await expect(menu.getByRole('menuitem', { name: /icon library/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /show shortcuts/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /new screen/i })).toHaveCount(0);

    // The menu itself fits the viewport.
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(390);

    // An app-menu action works: Icon Library opens its panel.
    await menu.getByRole('menuitem', { name: /icon library/i }).click();
    await expect(page.getByTestId('icon-library')).toBeVisible();

    // New Screen is still reachable on mobile — from the bottom bar.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTitle('New Screen (Ctrl+N)')).toBeVisible();
  });

  test('theme switcher is the first entry and drives both chrome and mockup', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('mobile-menu-button').click();
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();

    // Three 48px circles, above the first menu item.
    const switcher = menu.locator('.protota-theme-switcher');
    await expect(switcher).toBeVisible();
    const swatches = menu.locator('.protota-theme-swatch');
    await expect(swatches).toHaveCount(3);
    const switcherBox = await switcher.boundingBox();
    const firstItemBox = await menu.getByRole('menuitem').first().boundingBox();
    expect(switcherBox).not.toBeNull();
    expect(firstItemBox).not.toBeNull();
    expect(switcherBox!.y).toBeLessThan(firstItemBox!.y);

    // Defaults to Follow system: no forced theme on the document root.
    await expect(page.locator('html')).not.toHaveClass(/theme-dark|theme-light/);
    await expect(
      menu.getByRole('button', { name: 'Follow system style' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Pick Dark: the app chrome AND the mockup window both go dark, and the
    // selection moves to the Dark circle.
    await menu.getByRole('button', { name: 'Dark style' }).click();
    await expect(page.locator('html')).toHaveClass(/theme-dark/);
    await expect(page.locator('adw-window').first()).toHaveClass(/theme-dark/);
    await expect(menu.getByRole('button', { name: 'Dark style' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Follow system clears the override again.
    await menu.getByRole('button', { name: 'Follow system style' }).click();
    await expect(page.locator('html')).not.toHaveClass(/theme-dark|theme-light/);
    await expect(page.locator('adw-window').first()).not.toHaveClass(/theme-dark|theme-light/);
  });

  test('desktop viewport keeps the labelled menu buttons and the app-menu button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open/Export stay as labelled header buttons, Flows/Diagnostics stay as
    // icon toggles, and the hamburger (app-menu button) is present too — the
    // same header controls as on mobile. The app-menu holds the same entries
    // as the mobile menu: theme switcher + Icon Library + Show Shortcuts.
    await expect(page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true })).toBeVisible();
    await expect(page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await expect(page.getByTestId('app-header-bar').getByRole('button', { name: /flow/i })).toBeVisible();
    await expect(page.getByTestId('app-header-bar').getByRole('button', { name: /hig lint/i })).toBeVisible();
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    await page.getByTestId('mobile-menu-button').click();
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.protota-theme-switcher')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /icon library/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /show shortcuts/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /new screen/i })).toHaveCount(0);

    // The app-menu items work: Icon Library opens its panel.
    await menu.getByRole('menuitem', { name: /icon library/i }).click();
    await expect(page.getByTestId('icon-library')).toBeVisible();
  });
});
