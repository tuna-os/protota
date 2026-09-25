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

async function pickPosition(page: Page, side: 'start' | 'end') {
  // AppMenuButton rebuilds the popover's children whenever the preference
  // changes, so re-query the picker on every pick.
  await page
    .getByTestId('mobile-menu')
    .locator(`.protota-window-buttons-option[data-value="${side}"]`)
    .click();
}

test.describe('window-button position preference (#163)', () => {
  test('moving the controls to the start side never blanks the canvas', async ({ page }) => {
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(String(error)));

    await page.goto('/');
    await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });
    const widgets = await page.locator('[data-protota-type]').count();
    expect(widgets).toBeGreaterThan(0);

    // The window-buttons picker lives in the app-menu (present on every
    // viewport). Default preference draws the controls at the end.
    await page.getByTestId('mobile-menu-button').getByRole('button').click();
    await expect(page.getByTestId('mobile-menu')).toBeVisible();

    // The reported repro: flip the position to the start side.
    await pickPosition(page, 'start');
    await expect(page.locator('.protota-window-controls-start')).toHaveCount(1);

    // Exercise the reverse structural change too.
    await pickPosition(page, 'end');
    await expect(page.locator('.protota-window-controls-start')).toHaveCount(0);

    // No uncaught commit-phase exception, no blank canvas, no containment card.
    expect(crashes, crashes.join('\n')).toHaveLength(0);
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0))
      .toBeGreaterThan(0);
    expect(await page.locator('[data-testid="render-error-card"]').count()).toBe(0);
    expect(await page.locator('[data-protota-type]').count()).toBe(widgets);
  });
});
