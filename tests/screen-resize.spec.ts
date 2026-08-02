import { test, expect, type Page } from '@playwright/test';

/**
 * Live-resizable screens + Adw.Breakpoint behavior.
 *
 * Seeds the legacy `protota_doc_v1` key (boot migrates it through the
 * Blueprint round trip) with a single standard screen; the breakpoint flip
 * test loads the real GNOME Settings preset from its source bundle via the
 * gallery and drags it below its `max-width: 550sp` breakpoint.
 */

// Wide viewport so the resize handles of a ~1000px screen sit inside the
// visible canvas (mouse gestures need real on-screen coordinates).
test.use({ viewport: { width: 1700, height: 950 } });

interface StoreState {
  doc: {
    screens: Array<{ id: string; width: number; height: number; rootNode: { id: string } }>;
  };
  history: unknown[];
  historyIndex: number;
  selectNode: (nodeId: string | null, screenId?: string) => void;
}

const storeState = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __mockupStore: { getState: () => StoreState } }).__mockupStore.getState();
    return {
      screen: {
        id: s.doc.screens[0].id,
        width: s.doc.screens[0].width,
        height: s.doc.screens[0].height,
        rootId: s.doc.screens[0].rootNode.id,
      },
      historyLength: s.history.length,
      historyIndex: s.historyIndex,
    };
  });

const singleScreenDocument = {
  id: 'resize-doc',
  title: 'Resize Fixture',
  colorScheme: 'auto',
  edges: [],
  screens: [{
    id: 'screen-resize', title: 'Resizable', type: 'standard', width: 800, height: 600,
    rootNode: {
      id: 'root-window', type: 'window',
      children: [{
        id: 'toolbar', type: 'toolbar-view',
        children: [
          { id: 'hdr', type: 'header-bar', slot: 'top', title: 'Resizable', children: [] },
          { id: 'content', type: 'box', slot: 'content', orientation: 'vertical', spacing: 12, children: [] },
        ],
      }],
    },
  }],
};

async function seedSingleScreen(page: Page) {
  await page.goto('/');
  await page.evaluate((doc) => {
    localStorage.clear();
    localStorage.setItem('protota_doc_v1', JSON.stringify(doc));
  }, singleScreenDocument);
  await page.reload();
  await page.waitForSelector('adw-window', { timeout: 10000 });
}

/**
 * A handle's bounding box once layout has settled. On a cold dev server,
 * font loading and custom-element upgrades shift the frame for a moment
 * after first paint; a box measured too early aims the mouse at where the
 * handle USED to be (typically hitting the neighbouring edge handle).
 */
async function stableBox(page: Page, locator: ReturnType<Page['getByTestId']>) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let previous = await locator.boundingBox();
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    const current = await locator.boundingBox();
    if (previous && current &&
        Math.abs(current.x - previous.x) < 0.5 && Math.abs(current.y - previous.y) < 0.5 &&
        Math.abs(current.width - previous.width) < 0.5 && Math.abs(current.height - previous.height) < 0.5) {
      return current;
    }
    previous = current;
  }
  return previous!;
}

test.describe('screen resize', () => {
  test('drag on the corner handle resizes live and commits ONE undo snapshot', async ({ page }) => {
    await seedSingleScreen(page);
    const before = await storeState(page);
    expect(before.screen.width).toBe(800);

    const handle = page.getByTestId(`resize-corner-${before.screen.id}`);
    const box = await stableBox(page, handle);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move in two steps: the live preview should already show mid-drag.
    await page.mouse.move(box.x - 60, box.y - 40, { steps: 5 });
    await expect(page.getByTestId(`resize-size-chip-${before.screen.id}`)).toBeVisible();
    const midDrag = await storeState(page);
    // The document has NOT been touched while the gesture is in flight.
    expect(midDrag.screen.width).toBe(800);
    expect(midDrag.historyLength).toBe(before.historyLength);
    await page.mouse.move(box.x - 100, box.y - 60, { steps: 5 });
    await page.mouse.up();

    const after = await storeState(page);
    expect(after.screen.width).toBeLessThan(800);
    expect(after.screen.height).toBeLessThan(600);
    // Exactly one undo snapshot for the whole gesture.
    expect(after.historyLength).toBe(before.historyLength + 1);
    // The rendered surface follows the committed size.
    const surface = page.locator('[data-protota-render-surface]');
    const width = await surface.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe(`${after.screen.width}px`);

    // Undo restores the pre-drag size in one step.
    await page.keyboard.press('Control+z');
    const undone = await storeState(page);
    expect(undone.screen.width).toBe(800);
    expect(undone.screen.height).toBe(600);
  });

  test('right-edge handle resizes width only, clamped to the 200px minimum', async ({ page }) => {
    await seedSingleScreen(page);
    const { screen } = await storeState(page);
    const handle = page.getByTestId(`resize-right-${screen.id}`);
    const box = await stableBox(page, handle);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    const after = await storeState(page);
    expect(after.screen.width).toBe(200);
    expect(after.screen.height).toBe(600);
  });

  test('inspector shows width/height fields for the screen root and edits commit', async ({ page }) => {
    await seedSingleScreen(page);
    const { screen } = await storeState(page);
    await page.evaluate(({ rootId, id }) => {
      (window as unknown as { __mockupStore: { getState: () => StoreState } })
        .__mockupStore.getState().selectNode(rootId, id);
    }, { rootId: screen.rootId, id: screen.id });

    const widthInput = page.getByTestId('screen-width-input');
    const heightInput = page.getByTestId('screen-height-input');
    await expect(widthInput).toBeVisible();
    await expect(widthInput).toHaveValue('800');
    await expect(heightInput).toHaveValue('600');

    await widthInput.fill('640');
    const after = await storeState(page);
    expect(after.screen.width).toBe(640);
    const surface = page.locator('[data-protota-render-surface]');
    expect(await surface.evaluate((el) => (el as HTMLElement).style.width)).toBe('640px');
  });

  test('bottom-bar device presets resize the focused screen', async ({ page }) => {
    await seedSingleScreen(page);
    await page.getByTestId('size-preset-360x720').click();
    let state = await storeState(page);
    expect(state.screen.width).toBe(360);
    expect(state.screen.height).toBe(720);

    await page.getByTestId('size-preset-1280x800').click();
    state = await storeState(page);
    expect(state.screen.width).toBe(1280);
    expect(state.screen.height).toBe(800);
  });

  test('screen size survives the Blueprint persistence round trip', async ({ page }) => {
    await seedSingleScreen(page);
    await page.getByTestId('size-preset-360x720').click();
    await page.reload();
    await page.waitForSelector('adw-window', { timeout: 10000 });
    const state = await storeState(page);
    expect(state.screen.width).toBe(360);
    expect(state.screen.height).toBe(720);
  });
});

/**
 * Load the real GNOME Settings preset (live import from its official source
 * bundle) through the gallery. The gallery persists the imported document
 * and reloads the page; polling the reloaded store is robust against the
 * async import + navigation, where waitForNavigation races.
 */
async function loadSettingsPreset(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Generous first-paint budget: a cold dev server transforms the whole app
  // on this request, and parallel workers may be importing presets at once.
  await page.waitForSelector('adw-window', { timeout: 30000 });
  // Load Preset moved into the Open menu (#106 layout reorder).
  await page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('menuitem', { name: /load preset/i }).click();
  await page.locator('.protota-preset-item').filter({ hasText: /GNOME Settings/i }).first().click();
  await expect
    .poll(
      () => page
        .evaluate(() => (window as unknown as { __mockupStore?: { getState: () => { doc: { title: string } } } })
          .__mockupStore?.getState?.().doc.title)
        .catch(() => null),
      { timeout: 45000 },
    )
    .toBe('GNOME Settings');
  await page.waitForSelector('adw-window', { timeout: 15000 });
}

test.describe('Adw.Breakpoint behavior (GNOME Settings preset)', () => {
  test('resizing below 550sp collapses the split view and shows the indicator', async ({ page }) => {
    test.slow();
    await loadSettingsPreset(page);

    const state = await storeState(page);
    // Wide: the navigation split view's sidebar pane is rendered, no
    // breakpoint is active.
    const sidebar = page.locator('.protota-canvas [data-node-id="panel_list_page"]');
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId(`breakpoint-active-${state.screen.id}`)).toHaveCount(0);

    // Drag the right edge below the 550sp threshold.
    await page.evaluate((id) => {
      (window as unknown as { __mockupStore: { getState: () => StoreState & { updateScreenProps: (s: string, p: object) => void } } })
        .__mockupStore.getState().updateScreenProps(id, { width: 480 });
    }, state.screen.id);

    // Narrow: the breakpoint's `split_view.collapsed: true` setter applies —
    // the sidebar pane leaves the DOM and the active-breakpoint chip names
    // the condition.
    await expect(sidebar).toHaveCount(0);
    const chip = page.getByTestId(`breakpoint-active-${state.screen.id}`);
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('max-width: 550sp');

    // Back above the threshold: the sidebar returns (derived state only —
    // the document was never mutated by the breakpoint).
    await page.evaluate((id) => {
      (window as unknown as { __mockupStore: { getState: () => StoreState & { updateScreenProps: (s: string, p: object) => void } } })
        .__mockupStore.getState().updateScreenProps(id, { width: 980 });
    }, state.screen.id);
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId(`breakpoint-active-${state.screen.id}`)).toHaveCount(0);
  });

  test('drag-resizing across the threshold flips the layout live', async ({ page }) => {
    test.slow();
    await loadSettingsPreset(page);

    const state = await storeState(page);
    const sidebar = page.locator('.protota-canvas [data-node-id="panel_list_page"]');
    await expect(sidebar).toBeVisible();

    const handle = page.getByTestId(`resize-right-${state.screen.id}`);
    const box = await stableBox(page, handle);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Below the threshold mid-drag: the preview evaluates the breakpoint
    // BEFORE the commit — the flip is visible while dragging.
    await page.mouse.move(box.x - (state.screen.width - 480), box.y, { steps: 8 });
    await expect(sidebar).toHaveCount(0);
    await expect(page.getByTestId(`breakpoint-active-${state.screen.id}`)).toBeVisible();
    await page.mouse.up();

    const after = await storeState(page);
    expect(after.screen.width).toBeLessThanOrEqual(550);
    await expect(sidebar).toHaveCount(0);
  });
});
