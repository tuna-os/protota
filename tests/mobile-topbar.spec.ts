import { test, expect } from '@playwright/test';

// Issue #99: on mobile-sized viewports the top bar collapses into a compact
// header — app identity plus an app-menu button at the header end — instead
// of the desktop menu bar and direct-access buttons overflowing the screen.
// The labelled Open/Export menu buttons render on every viewport; the
// overflow menu is an <adw-menu-button> whose first entry is a 3-circle
// theme switcher, followed by the mobile-only Actions entry and the
// app-menu items.
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

    // Hamburger is visible, as are the labelled Open/Export menu buttons;
    // the old menu bar and direct-access buttons are gone.
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await expect(header.getByRole('button', { name: /save json/i })).toHaveCount(0);
    await expect(header.getByRole('button', { name: /hig lint/i })).toHaveCount(0);

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

    // Collapsed actions are reachable from the overflow menu: the mobile-only
    // Actions entry plus the app-menu items. (Accessible names include
    // keyboard shortcuts, e.g. "New Screen Ctrl+N"; the adw-menu-button
    // renders items as role=menuitem.) Open/Export are labelled header
    // buttons on every viewport, so Load Preset / Export / Share URL are not
    // in the overflow anymore.
    await expect(menu.getByRole('menuitem', { name: /new screen/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /icon library/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /show shortcuts/i })).toBeVisible();

    // The menu itself fits the viewport.
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(390);

    // An action in the overflow menu works: New Screen opens its modal.
    await menu.getByRole('menuitem', { name: /new screen/i }).click();
    await expect(page.locator('.protota-modal')).toBeVisible();
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

  test('desktop viewport keeps the labelled menu buttons and shows the app-menu button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open/Export stay as labelled header buttons; the hamburger (app-menu
    // button) is present on desktop too and holds the theme switcher + Icon
    // Library + Show Shortcuts (the app-menu idiom).
    await expect(page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true })).toBeVisible();
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    await page.getByTestId('mobile-menu-button').click();
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.protota-theme-switcher')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /icon library/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /show shortcuts/i })).toBeVisible();

    // The app-menu items work: Icon Library opens its panel.
    await menu.getByRole('menuitem', { name: /icon library/i }).click();
    await expect(page.getByTestId('icon-library')).toBeVisible();
  });
});
