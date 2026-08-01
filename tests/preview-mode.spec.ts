import { test, expect, type Page } from '@playwright/test';

// Full-screen interactive preview (prototype mode): the Phone/Desktop
// preview toggles open a top-layer overlay covering the entire viewport,
// where clicks act on the mockup — flow-edge navigation and ephemeral
// widget state — and never mutate the document or the undo history.

interface SeededIds {
  homeId: string;
  detailsId: string;
}

/**
 * Seed a two-screen document through the store: Home (with a button that is
 * a flow trigger and a switch-row) --edge--> Details.
 */
async function seedFlowDocument(page: Page): Promise<SeededIds> {
  await page.goto('/');
  await page.waitForSelector('adw-window', { timeout: 10000 });
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const store = (window as any).__mockupStore;
    const state = store.getState();
    state.addScreen('Details', 'standard');

    const findByType = (node: any, type: string): any => {
      if (node.type === type) return node;
      for (const child of node.children ?? []) {
        const found = findByType(child, type);
        if (found) return found;
      }
      return null;
    };

    let doc = store.getState().doc;
    const homeId = doc.screens[0].id;
    const detailsId = doc.screens[1].id;
    state.addEdge(homeId, detailsId);

    const contentBox = findByType(store.getState().doc.screens[0].rootNode, 'box');
    state.addChildNode(contentBox.id, 'button');
    doc = store.getState().doc;
    const button = findByType(doc.screens[0].rootNode, 'button');
    state.updateNodeProps(button.id, { title: 'Open Details' });

    state.addChildNode(contentBox.id, 'list-box');
    doc = store.getState().doc;
    const listBox = findByType(doc.screens[0].rootNode, 'list-box');
    state.addChildNode(listBox.id, 'switch-row');

    state.selectNode(null);
    return { homeId, detailsId };
  });
}

const historyLength = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __mockupStore: { getState: () => { history: unknown[] } } })
      .__mockupStore.getState().history.length,
  );

const docJson = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify(
      (window as unknown as { __mockupStore: { getState: () => { doc: unknown } } })
        .__mockupStore.getState().doc,
    ),
  );

test.describe('Full-screen interactive preview', () => {
  test('phone preview covers the viewport and hides the editor chrome', async ({ page }) => {
    await seedFlowDocument(page);

    await page.getByTitle('Toggle Phone Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    await expect(overlay).toBeVisible();

    // The overlay owns the entire viewport.
    const viewport = page.viewportSize()!;
    const box = (await overlay.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(box.height).toBe(viewport.height);

    // Editor chrome is hidden while previewing.
    await expect(page.locator('.protota-zoom-bar')).toBeHidden();

    // The floating exit chip closes the preview and the chrome returns.
    await page.getByTestId('preview-exit').click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('.protota-zoom-bar')).toBeVisible();
  });

  test('desktop preview gets the same full-screen treatment', async ({ page }) => {
    await seedFlowDocument(page);

    await page.getByTitle('Toggle Desktop Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    await expect(overlay).toBeVisible();

    const viewport = page.viewportSize()!;
    const box = (await overlay.boundingBox())!;
    expect(box.width).toBe(viewport.width);
    expect(box.height).toBe(viewport.height);
    await expect(page.locator('.protota-zoom-bar')).toBeHidden();

    await page.getByTestId('preview-exit').click();
    await expect(overlay).toHaveCount(0);
  });

  test('tapping a flow-source widget navigates; Back returns; no undo entries', async ({ page }) => {
    const { homeId, detailsId } = await seedFlowDocument(page);
    const undoDepthBefore = await historyLength(page);

    await page.getByTitle('Toggle Phone Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    await expect(overlay).toHaveAttribute('data-preview-screen', homeId);
    await expect(overlay.getByTestId('preview-back')).toHaveCount(0);

    // The button is an activation: it follows Home's outgoing flow edge.
    await overlay.locator('adw-button', { hasText: 'Open Details' }).click();
    await expect(overlay).toHaveAttribute('data-preview-screen', detailsId);
    await expect(overlay).toContainText('Details');

    // Breadcrumb back.
    await overlay.getByTestId('preview-back').click();
    await expect(overlay).toHaveAttribute('data-preview-screen', homeId);
    await expect(overlay.getByTestId('preview-back')).toHaveCount(0);

    // Navigation is playback, not editing: the undo history never grew.
    expect(await historyLength(page)).toBe(undoDepthBefore);
  });

  test('screen picker jumps between screens from inside the preview', async ({ page }) => {
    const { detailsId } = await seedFlowDocument(page);

    await page.getByTitle('Toggle Phone Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    await overlay.getByTestId('preview-screen-select').selectOption(detailsId);
    await expect(overlay).toHaveAttribute('data-preview-screen', detailsId);
  });

  test('switch toggles are ephemeral: visual state changes, document and undo do not', async ({ page }) => {
    await seedFlowDocument(page);
    const undoDepthBefore = await historyLength(page);
    const docBefore = await docJson(page);

    await page.getByTitle('Toggle Phone Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    const switchInput = overlay.locator('adw-switch-row input[type="checkbox"]');
    await expect(switchInput).not.toBeChecked();

    await overlay.locator('adw-switch-row .adw-switch').click();
    await expect(switchInput).toBeChecked();

    // NO store mutation, NO undo entry.
    expect(await historyLength(page)).toBe(undoDepthBefore);
    expect(await docJson(page)).toBe(docBefore);

    // Escape exits; re-entering resets the ephemeral state.
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await page.getByTitle('Toggle Phone Preview').click();
    await expect(
      page.getByTestId('preview-overlay').locator('adw-switch-row input[type="checkbox"]'),
    ).not.toBeChecked();
    expect(await historyLength(page)).toBe(undoDepthBefore);
  });
});

// Issue: at phone widths the bottom bar clipped horizontally (zoom cluster +
// New Screen + device presets + preview toggles in one row). Mobile keeps the
// essentials inline and moves the rest into a "⋯" overflow popover.
test.describe('Mobile bottom bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fits the viewport with no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    const bar = page.getByTestId('bottom-bar');
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    // Essentials stay inline; the device presets are collapsed away.
    await expect(bar.getByTitle('Zoom In (Ctrl+=)')).toBeVisible();
    await expect(bar.getByTitle('Zoom Out (Ctrl+-)')).toBeVisible();
    await expect(bar.getByTitle('Fit All Screens')).toBeVisible();
    await expect(bar.getByTitle('New Screen (Ctrl+N)')).toBeVisible();
    await expect(bar.getByTitle('Toggle Phone Preview')).toBeVisible();
    await expect(bar.getByTitle('Toggle Desktop Preview')).toBeVisible();
    await expect(page.getByTestId('size-preset-800x600')).toHaveCount(0);
  });

  test('overflow popover exposes the collapsed device presets', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    await page.getByTestId('bottombar-overflow-button').click();
    const menu = page.getByTestId('bottombar-overflow-menu');
    await expect(menu).toBeVisible();

    // The popover itself fits the viewport.
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);

    // Presets are reachable and functional from the popover.
    const preset = menu.getByTestId('size-preset-800x600');
    await expect(preset).toBeVisible();
    await preset.click();
    await expect(menu).toBeHidden();
    const size = await page.evaluate(() => {
      const doc = (window as unknown as {
        __mockupStore: { getState: () => { doc: { screens: Array<{ width: number; height: number }> } } };
      }).__mockupStore.getState().doc;
      return { width: doc.screens[0].width, height: doc.screens[0].height };
    });
    expect(size).toEqual({ width: 800, height: 600 });
  });
});
