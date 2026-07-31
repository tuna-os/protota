import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Drag and drop (#79): palette → canvas insertion via HTML5 drag events,
 * canvas reparenting via pointer drags, and layer-tree row drags. Every
 * assertion is semantic — store state, historyIndex deltas, indicator
 * elements — per docs/penpot-study.md §9.
 */

interface NodeShape { id: string; type: string; title?: string; children?: NodeShape[] }

interface StoreShape {
  getState: () => {
    doc: { screens: Array<{ id: string; rootNode: NodeShape }> };
    historyIndex: number;
    selectedNodeId: string | null;
    addChildNode: (parentId: string, type: string) => string | null;
    addScreen: (title: string, type: string) => void;
  };
}

/** First node of a given type in the first screen, depth-first. */
async function nodeIdByType(page: Page, type: string, screenIndex = 0): Promise<string> {
  return page.evaluate(([wantedType, index]) => {
    const s = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const find = (node: NodeShape): NodeShape | null => {
      if (node.type === wantedType) return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    interface NodeShape { id: string; type: string; children?: NodeShape[] }
    interface StoreShape { getState: () => { doc: { screens: Array<{ rootNode: NodeShape }> } } }
    const hit = find(s.doc.screens[Number(index)].rootNode);
    if (!hit) throw new Error(`no ${wantedType} node`);
    return hit.id;
  }, [type, String(screenIndex)] as const);
}

async function childTypes(page: Page, parentId: string): Promise<string[]> {
  return page.evaluate((id) => {
    interface NodeShape { id: string; type: string; children?: NodeShape[] }
    interface StoreShape { getState: () => { doc: { screens: Array<{ rootNode: NodeShape }> } } }
    const s = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const find = (node: NodeShape): NodeShape | null => {
      if (node.id === id) return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    for (const screen of s.doc.screens) {
      const hit = find(screen.rootNode);
      if (hit) return (hit.children ?? []).map((c) => c.type);
    }
    throw new Error('parent not found');
  }, parentId);
}

const historyIndex = (page: Page) =>
  page.evaluate(() => {
    interface StoreShape { getState: () => { historyIndex: number } }
    return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().historyIndex;
  });

const canvasNode = (page: Page, id: string): Locator =>
  page.locator(`.protota-canvas [data-node-id="${id}"]`);

/** Synthesize an HTML5 drag from a palette entry to a canvas point. */
async function html5Drag(
  page: Page, source: Locator, target: Locator,
  opts: { drop: boolean } = { drop: true },
) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  const box = await target.boundingBox();
  if (!box) throw new Error('target has no box');
  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  await target.dispatchEvent('dragover', { dataTransfer, clientX, clientY });
  if (opts.drop) {
    await target.dispatchEvent('drop', { dataTransfer, clientX, clientY });
  }
  await source.dispatchEvent('dragend', { dataTransfer });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });
});

test.describe('palette → canvas (HTML5 drag)', () => {
  test('dragging a widget over a legal container highlights it and drop inserts one undo entry', async ({ page }) => {
    await page.getByTestId('left-tab-widgets').click();
    const entry = page.locator('[data-testid="palette-item"][data-widget-type="button"]');
    await expect(entry).toBeVisible();

    const boxId = await nodeIdByType(page, 'box');
    const before = await historyIndex(page);

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await entry.dispatchEvent('dragstart', { dataTransfer });
    const box = await canvasNode(page, boxId).boundingBox();
    if (!box) throw new Error('box not rendered');
    const clientX = box.x + box.width / 2;
    const clientY = box.y + box.height / 2;
    await canvasNode(page, boxId).dispatchEvent('dragover', { dataTransfer, clientX, clientY });

    // Preview only: highlight shows, document untouched.
    await expect(page.getByTestId('dnd-target-highlight')).toBeVisible();
    expect(await historyIndex(page)).toBe(before);

    await canvasNode(page, boxId).dispatchEvent('drop', { dataTransfer, clientX, clientY });
    await entry.dispatchEvent('dragend', { dataTransfer });

    expect(await childTypes(page, boxId)).toContain('button');
    expect(await historyIndex(page)).toBe(before + 1);
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);

    // One gesture, one undo entry.
    await page.keyboard.press('Control+z');
    expect(await childTypes(page, boxId)).not.toContain('button');
    expect(await historyIndex(page)).toBe(before);
  });

  test('dropping on empty canvas background does nothing', async ({ page }) => {
    await page.getByTestId('left-tab-widgets').click();
    const entry = page.locator('[data-testid="palette-item"][data-widget-type="button"]');
    const before = await historyIndex(page);

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await entry.dispatchEvent('dragstart', { dataTransfer });
    const canvas = page.locator('.protota-canvas');
    await canvas.dispatchEvent('dragover', { dataTransfer, clientX: 400, clientY: 120 });
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);
    await canvas.dispatchEvent('drop', { dataTransfer, clientX: 400, clientY: 120 });
    await entry.dispatchEvent('dragend', { dataTransfer });

    expect(await historyIndex(page)).toBe(before);
  });

  test('a widget the container rejects shows no target and drops nowhere', async ({ page }) => {
    // alert-dialog only legally holds label/button; a box must be refused.
    await page.evaluate(() => {
      interface StoreShape { getState: () => { addScreen: (t: string, k: string) => void } }
      (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState()
        .addScreen('Alert', 'alert-dialog');
    });
    await page.waitForSelector('html[data-protota-ready]');
    const alertRootId = await nodeIdByType(page, 'alert-dialog', 1);
    await page.getByTestId('left-tab-widgets').click();
    const entry = page.locator('[data-testid="palette-item"][data-widget-type="box"]');
    const before = await historyIndex(page);

    await html5Drag(page, entry, canvasNode(page, alertRootId));
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);
    expect(await childTypes(page, alertRootId)).toEqual(['button', 'button']);
    expect(await historyIndex(page)).toBe(before);
  });
});

test.describe('layer tree drag (reorder/reparent)', () => {
  const row = (page: Page, text: string) =>
    page.locator('[data-testid="layer-row"]').filter({ hasText: text }).first();

  test('dropping a row onto a container row reparents into it', async ({ page }) => {
    const boxId = await nodeIdByType(page, 'box');
    const before = await historyIndex(page);

    const labelRow = row(page, 'label (');
    const boxRow = row(page, 'box (');
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await labelRow.dispatchEvent('dragstart', { dataTransfer });
    const b = await boxRow.boundingBox();
    if (!b) throw new Error('no row box');
    // Middle of the row → "inside".
    await boxRow.dispatchEvent('dragover', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
    await expect(boxRow).toHaveAttribute('data-drop-position', 'inside');
    await boxRow.dispatchEvent('drop', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
    await labelRow.dispatchEvent('dragend', { dataTransfer });

    expect(await childTypes(page, boxId)).toEqual(['clamp', 'label']);
    expect(await historyIndex(page)).toBe(before + 1);
  });

  test('dropping near a row edge inserts before it, as a sibling', async ({ page }) => {
    const boxId = await nodeIdByType(page, 'box');
    expect(await childTypes(page, boxId)).toEqual(['clamp']);
    const before = await historyIndex(page);

    // Move the label (inside clamp) to be box's first child, before clamp.
    const labelRow = row(page, 'label (');
    const clampRow = row(page, 'clamp (');
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await labelRow.dispatchEvent('dragstart', { dataTransfer });
    const b = await clampRow.boundingBox();
    if (!b) throw new Error('no row box');
    // Top edge of the row → "before".
    await clampRow.dispatchEvent('dragover', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + 2 });
    await expect(clampRow).toHaveAttribute('data-drop-position', 'before');
    await clampRow.dispatchEvent('drop', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + 2 });
    await labelRow.dispatchEvent('dragend', { dataTransfer });

    expect(await childTypes(page, boxId)).toEqual(['label', 'clamp']);
    expect(await historyIndex(page)).toBe(before + 1);
  });

  test('a row never drops into its own subtree', async ({ page }) => {
    const before = await historyIndex(page);
    const toolbarRow = row(page, 'toolbar-view (');
    const headerRow = row(page, 'header-bar (');
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await toolbarRow.dispatchEvent('dragstart', { dataTransfer });
    const b = await headerRow.boundingBox();
    if (!b) throw new Error('no row box');
    await headerRow.dispatchEvent('dragover', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
    // header-bar is inside toolbar-view: no legal position exists on this row.
    await expect(headerRow).not.toHaveAttribute('data-drop-position');
    await headerRow.dispatchEvent('drop', { dataTransfer, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
    await toolbarRow.dispatchEvent('dragend', { dataTransfer });
    expect(await historyIndex(page)).toBe(before);
  });
});

test.describe('canvas reparent (pointer drag)', () => {
  /** Add a button to the content box and select it; returns [buttonId, clampId]. */
  async function seed(page: Page): Promise<[string, string]> {
    const boxId = await nodeIdByType(page, 'box');
    const clampId = await nodeIdByType(page, 'clamp');
    const buttonId = await page.evaluate((parent) => {
      interface StoreShape { getState: () => { addChildNode: (p: string, t: string) => string | null } }
      return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState()
        .addChildNode(parent, 'button');
    }, boxId);
    if (!buttonId) throw new Error('seed failed');
    await page.waitForSelector('html[data-protota-ready]');
    await canvasNode(page, buttonId).click();
    await expect.poll(() => page.evaluate(() => {
      interface StoreShape { getState: () => { selectedNodeId: string | null } }
      return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().selectedNodeId;
    })).toBe(buttonId);
    return [buttonId, clampId];
  }

  const center = async (locator: Locator) => {
    const b = await locator.boundingBox();
    if (!b) throw new Error('no box');
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  test('pointer-dragging the selected node into a container commits one moveNode', async ({ page }) => {
    const [buttonId, clampId] = await seed(page);
    const before = await historyIndex(page);

    const from = await center(canvasNode(page, buttonId));
    const to = await center(canvasNode(page, clampId));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });

    // Live preview: highlight visible, document untouched.
    await expect(page.getByTestId('dnd-target-highlight')).toBeVisible();
    expect(await historyIndex(page)).toBe(before);

    await page.mouse.up();
    expect(await childTypes(page, clampId)).toContain('button');
    expect(await historyIndex(page)).toBe(before + 1);
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);

    // Still exactly one undo step back to the pre-drag tree.
    await page.keyboard.press('Control+z');
    expect(await childTypes(page, clampId)).not.toContain('button');
  });

  test('Escape cancels the drag; nothing moves, nothing lands in history', async ({ page }) => {
    const [buttonId, clampId] = await seed(page);
    const before = await historyIndex(page);

    const from = await center(canvasNode(page, buttonId));
    const to = await center(canvasNode(page, clampId));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await expect(page.getByTestId('dnd-target-highlight')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);
    await page.mouse.up();

    expect(await childTypes(page, clampId)).not.toContain('button');
    expect(await historyIndex(page)).toBe(before);
    // Escape must cancel the drag, not deselect the node.
    expect(await page.evaluate(() => {
      interface StoreShape { getState: () => { selectedNodeId: string | null } }
      return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().selectedNodeId;
    })).toBe(buttonId);
  });

  test('releasing over an illegal area moves nothing', async ({ page }) => {
    const [buttonId] = await seed(page);
    const boxId = await nodeIdByType(page, 'box');
    const before = await historyIndex(page);

    const from = await center(canvasNode(page, buttonId));
    const canvasBox = await page.locator('.protota-canvas').boundingBox();
    if (!canvasBox) throw new Error('no canvas box');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // Empty canvas background (top-left corner): no node under the pointer.
    await page.mouse.move(canvasBox.x + 15, canvasBox.y + 15, { steps: 8 });
    await expect(page.getByTestId('dnd-target-highlight')).toHaveCount(0);
    await page.mouse.up();

    expect(await childTypes(page, boxId)).toContain('button');
    expect(await historyIndex(page)).toBe(before);
  });
});
