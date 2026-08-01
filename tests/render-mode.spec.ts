import { test, expect, type Page } from '@playwright/test';

/**
 * URL render mode + agent screenshot API (docs/render-api.md).
 *
 * The render mode is the agent-facing screenshot surface: `?render=1&…`
 * mounts a chromeless single-screen view, `html[data-protota-ready="true"]`
 * signals a settled frame, and `#protota-render-root` is the element an
 * external agent screenshots.
 */

const READY = 'html[data-protota-ready="true"]';

async function gotoRender(page: Page, params: string) {
  await page.goto(`/protota/?render=1&${params}`);
  await page.waitForSelector(READY, { timeout: 45000 });
}

test.describe('URL render mode', () => {
  test('renders only the screen — no editor chrome', async ({ page }) => {
    await gotoRender(page, 'preset=files');

    await expect(page.locator('#protota-render-root [data-protota-render-surface]')).toBeVisible();
    // None of the editor chrome ever mounts.
    await expect(page.locator('.protota-canvas')).toHaveCount(0);
    await expect(page.locator('.protota-panel')).toHaveCount(0);
    await expect(page.locator('.protota-zoom-bar')).toHaveCount(0);
    await expect(page.locator('.protota-screen-label')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /new screen|load preset/i })).toHaveCount(0);
    // The render root is anchored at the page origin, 1:1.
    const box = await page.locator('#protota-render-root').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
  });

  test('width/height params size the rendered surface exactly', async ({ page }) => {
    await gotoRender(page, 'preset=files&width=500&height=440');
    const box = await page.locator('[data-protota-render-surface]').boundingBox();
    expect(Math.round(box!.width)).toBe(500);
    expect(Math.round(box!.height)).toBe(440);
  });

  test('Adw.Breakpoint state flips between two widths of the same screen', async ({ page }) => {
    test.slow();
    // GNOME Settings: navigation split view whose sidebar collapses below
    // its `max-width: 550sp` breakpoint (#141). Wide render: sidebar pane
    // present.
    await gotoRender(page, 'preset=settings&width=900&height=600');
    const sidebar = page.locator('#protota-render-root [data-node-id="panel_list_page"]');
    await expect(sidebar).toBeVisible();

    // Narrow render of the SAME screen: the breakpoint's
    // `split_view.collapsed: true` setter applies and the sidebar pane
    // leaves the DOM.
    await gotoRender(page, 'preset=settings&width=480&height=600');
    await expect(page.locator('#protota-render-root [data-protota-render-surface]')).toBeVisible();
    await expect(page.locator('#protota-render-root [data-node-id="panel_list_page"]')).toHaveCount(0);
  });

  test('theme=dark forces the dark scheme on the rendered window', async ({ page }) => {
    await gotoRender(page, 'preset=files&theme=dark');
    const surface = page.locator('[data-protota-render-surface]');
    await expect(surface).toHaveClass(/theme-dark/);
    // The scoped variable block makes the theme real, not just a class.
    const windowBg = await surface.evaluate((el) => getComputedStyle(el).getPropertyValue('--window-bg-color').trim());
    expect(windowBg).toBe('#222226');

    await gotoRender(page, 'preset=files&theme=light');
    const lightBg = await page
      .locator('[data-protota-render-surface]')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--window-bg-color').trim());
    expect(lightBg).toBe('#fafafb');
  });

  test('unknown preset shows visible error text, never a wrong frame', async ({ page }) => {
    await gotoRender(page, 'preset=does-not-exist');
    const error = page.locator('#protota-render-root [data-protota-render-error]');
    await expect(error).toBeVisible();
    await expect(error).toContainText('does-not-exist');
    await expect(page.locator('[data-protota-render-surface]')).toHaveCount(0);
  });

  test('unknown screen and invalid params also fail loudly', async ({ page }) => {
    await gotoRender(page, 'preset=files&screen=nope');
    await expect(page.locator('[data-protota-render-error]')).toContainText('Unknown screen "nope"');

    await gotoRender(page, 'width=banana');
    await expect(page.locator('[data-protota-render-error]')).toContainText('width');
  });

  test('renders the persisted document when no preset is given', async ({ page }) => {
    await gotoRender(page, 'width=640&height=480');
    // The default document's single standard screen, at the override size.
    const box = await page.locator('[data-protota-render-surface]').boundingBox();
    expect(Math.round(box!.width)).toBe(640);
    expect(Math.round(box!.height)).toBe(480);
  });
});

test.describe('protota.renderScreenshot', () => {
  test('resolves to a non-empty PNG blob with the requested dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(READY, { timeout: 45000 });

    const result = await page.evaluate(async () => {
      const api = (window as unknown as {
        protota: { renderScreenshot: (options: object) => Promise<Blob> };
      }).protota;
      const blob = await api.renderScreenshot({ width: 500, height: 400, theme: 'dark' });
      const bitmap = await createImageBitmap(blob);
      return { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height };
    });

    expect(result.type).toBe('image/png');
    expect(result.size).toBeGreaterThan(1000);
    expect(result.width).toBe(500);
    expect(result.height).toBe(400);
  });

  test('leaves the live editor untouched and rejects bad arguments', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(READY, { timeout: 45000 });

    const before = await page.evaluate(() => {
      const store = (window as unknown as {
        __mockupStore: { getState: () => { historyIndex: number; doc: { screens: { width: number }[] } } };
      }).__mockupStore.getState();
      return { historyIndex: store.historyIndex, width: store.doc.screens[0].width };
    });

    await page.evaluate(() =>
      (window as unknown as { protota: { renderScreenshot: (o: object) => Promise<Blob> } })
        .protota.renderScreenshot({ width: 500, height: 400 }),
    );

    const after = await page.evaluate(() => {
      const store = (window as unknown as {
        __mockupStore: { getState: () => { historyIndex: number; doc: { screens: { width: number }[] } } };
      }).__mockupStore.getState();
      return { historyIndex: store.historyIndex, width: store.doc.screens[0].width };
    });
    expect(after).toEqual(before);
    // The offscreen container is cleaned up.
    await expect(page.locator('[data-protota-capture-scope]')).toHaveCount(0);

    const error = await page.evaluate(() =>
      (window as unknown as { protota: { renderScreenshot: (o: object) => Promise<Blob> } })
        .protota.renderScreenshot({ screenId: 'nope' })
        .then(() => null, (err: Error) => err.message),
    );
    expect(error).toContain('unknown screen "nope"');
  });
});
