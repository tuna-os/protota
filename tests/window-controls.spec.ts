import { test, expect, type Page } from '@playwright/test';

/**
 * #163 — moving the renderer-drawn window controls to the start side blanked
 * the canvas.
 *
 * The window-controls div's React key and slot change with the preference's
 * side, but AdwaitaRenderer's host key for adw-header-bar only recorded the
 * controls *kind*. React therefore kept the host in place and called
 * removeChild on the old controls node — a child the adw-header-bar custom
 * element had already reparented via replaceChildren on connect — throwing
 * NotFoundError in the commit phase and unmounting the screen. Recording the
 * side in the host key makes the structural change remount the host (inside
 * the wrapper div React still owns) instead.
 */

async function pickPosition(page: Page, name: RegExp) {
  // Each window-control entry closes the app-menu, so reopen it before every
  // pick; AppMenuButton rebuilds the popover's children whenever the
  // preference changes, so re-query the row after opening.
  await page.getByTestId('mobile-menu-button').getByRole('button').click();
  const menu = page.getByTestId('mobile-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name }).click();
  await expect(menu).not.toBeVisible();
}

test.describe('window-button position preference (#163)', () => {
  test('moving the controls to the start side never blanks the canvas', async ({ page }) => {
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(String(error)));

    await page.goto('/');
    await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });
    const widgets = await page.locator('[data-protota-type]').count();
    expect(widgets).toBeGreaterThan(0);

    // The window-control entries live in the app-menu (present on every
    // viewport). Default preference draws the controls at the end.
    const controlOrder = () =>
      page.locator('.protota-window-control')
        .evaluateAll((els) => els.map((el) => el.className.replace('protota-window-control ', '')));
    expect(await controlOrder()).toEqual(['minimize', 'maximize', 'close']);

    // The reported repro: flip the position to the start side. The buttons
    // mirror, so the order reverses — close against the window edge. The entry
    // is labelled by the state it switches to, so with the default (end)
    // preference it offers the left side.
    await pickPosition(page, /apply left window controls/i);
    await expect(page.locator('.protota-window-controls-start')).toHaveCount(1);
    expect(await controlOrder()).toEqual(['close', 'maximize', 'minimize']);

    // Exercise the reverse structural change too.
    await pickPosition(page, /apply right window controls/i);
    await expect(page.locator('.protota-window-controls-start')).toHaveCount(0);
    expect(await controlOrder()).toEqual(['minimize', 'maximize', 'close']);

    // No uncaught commit-phase exception, no blank canvas, no containment card.
    expect(crashes, crashes.join('\n')).toHaveLength(0);
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0))
      .toBeGreaterThan(0);
    expect(await page.locator('[data-testid="render-error-card"]').count()).toBe(0);
    expect(await page.locator('[data-protota-type]').count()).toBe(widgets);
  });
});
