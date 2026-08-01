import { test, expect, type Page } from '@playwright/test';

/**
 * #137 — deleting through the GNOME Clocks preset blanked the whole app.
 *
 * Two compounding bugs:
 *  1. Preset screens reuse node ids (every Clocks screen roots at
 *     `imported-1`), and deleteNode's global first-match search deleted
 *     same-id nodes from screens the user never touched.
 *  2. Several adw-* custom elements (adw-toolbar-view, adw-header-bar,
 *     adw-toast-overlay) adopt their light-DOM children into internal
 *     wrappers on connect, so React's later removeChild on the host threw
 *     NotFoundError in the commit phase and unmounted the entire app.
 *
 * This spec replays the exact reported repro: load Clocks, click the last
 * window, delete, repeat — down past the last window's content.
 */

async function loadClocks(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const response = await fetch('./presets/clocks.mockup.json');
    const payload = await response.json();
    localStorage.setItem('protota_doc_v1', JSON.stringify(payload.document));
    if (payload.sourceIcons) {
      localStorage.setItem('protota_source_icons_v1', JSON.stringify(payload.sourceIcons));
    }
  });
  await page.reload();
  await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });
}

test.describe('delete survives reparented custom-element subtrees (#137)', () => {
  test('deleting down to the last window never blanks the app', async ({ page }) => {
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(String(error)));

    await loadClocks(page);
    const surfaces = page.locator('[data-protota-render-surface="true"]');
    const initialSurfaces = await surfaces.count();
    expect(initialSurfaces).toBeGreaterThan(0);
    const initialWidgets = await page.locator('[data-protota-type]').count();

    // The reported gesture: click into the last window, press Delete,
    // repeat — draining it down to the bare root. This walks straight
    // through the adopted subtrees (the dialog's header-bar and content box
    // live inside adw-toolbar-view's internal wrappers): before the fix one
    // of these deletes crashed React's commit phase with NotFoundError
    // (removeChild through an adopting custom element) and unmounted the
    // whole app; the final delete of the bare root window is a no-op.
    let deletes = 0;
    for (let i = 0; i < 8; i++) {
      if ((await surfaces.count()) === 0) break;
      await surfaces.last().click({ position: { x: 12, y: 12 } });
      await page.keyboard.press('Delete');
      deletes += 1;
      await page.waitForTimeout(100);
    }

    // No uncaught commit-phase exception, no blank app, no containment card:
    // the structural fix keeps React and the real DOM agreeing.
    expect(crashes, crashes.join('\n')).toHaveLength(0);
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0))
      .toBeGreaterThan(0);
    expect(await surfaces.count()).toBeGreaterThan(0);
    expect(await page.locator('[data-testid="render-error-card"]').count()).toBe(0);

    // The canvas is still interactive: a click still selects a node.
    await surfaces.first().click({ position: { x: 12, y: 12 } });
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });

    // Undo restores everything that was deleted — the store survived intact.
    for (let i = 0; i < deletes; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(80);
    }
    expect(await surfaces.count()).toBe(initialSurfaces);
    expect(await page.locator('[data-protota-type]').count()).toBe(initialWidgets);
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('deleting on one screen never removes content from another screen', async ({ page }) => {
    await loadClocks(page);
    const surfaces = page.locator('[data-protota-render-surface="true"]');
    const firstScreenWidgets = await surfaces.first().locator('[data-protota-type]').count();

    // Select something inside the LAST window (the New Alarm dialog, whose
    // ids duplicate nodes on every other screen) and delete it. Before the
    // fix this removed a same-id node from screen 1 instead.
    await surfaces.last().click({ position: { x: 12, y: 12 } });
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);

    expect(await surfaces.first().locator('[data-protota-type]').count())
      .toBe(firstScreenWidgets);
  });

  test('a commit-phase crash is contained to an in-canvas card and undo recovers', async ({ page }) => {
    await loadClocks(page);
    const surfaces = page.locator('[data-protota-render-surface="true"]');
    const initialSurfaces = await surfaces.count();

    // Select main_page (child of the div-rendered navigation-view) via a
    // direct element click, then sabotage the real DOM: rip its wrapper out
    // of the parent React thinks owns it. The subsequent delete makes
    // React's removeChild throw NotFoundError in the commit phase — the
    // class of error that used to unmount the entire application.
    await page.evaluate(() => {
      (document.querySelector('[data-node-id="main_page"]') as HTMLElement).click();
    });
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
    await page.evaluate(() => {
      const wrapper = document.querySelector('.selected-outline')!;
      document.body.appendChild(wrapper);
    });
    await page.keyboard.press('Delete');

    // Contained: the failed screen shows the render-error card; the rest of
    // the editor is alive.
    await expect(page.locator('[data-testid="render-error-card"]').first())
      .toBeVisible({ timeout: 3000 });
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0))
      .toBeGreaterThan(0);

    // The store survived: undo advances the document, which auto-clears the
    // failure and re-renders every screen.
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-testid="render-error-card"]')).toHaveCount(0, { timeout: 3000 });
    expect(await surfaces.count()).toBe(initialSurfaces);
  });
});
