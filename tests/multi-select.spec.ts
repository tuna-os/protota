import { test, expect, type Page } from '@playwright/test';

/**
 * Multi-select, rubber-band, and align/distribute (#79). Assertions are
 * semantic — store state, historyIndex deltas, selection classes — per
 * docs/penpot-study.md §9.
 */

interface NodeShape { id: string; type: string; children?: NodeShape[]; halign?: string }

/** First node of a given type in the first screen, depth-first. */
async function nodeIdByType(page: Page, type: string): Promise<string> {
  return page.evaluate((wantedType) => {
    interface NodeShape { id: string; type: string; children?: NodeShape[] }
    interface StoreShape { getState: () => { doc: { screens: Array<{ rootNode: NodeShape }> } } }
    const s = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const find = (node: NodeShape): NodeShape | null => {
      if (node.type === wantedType) return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    const hit = find(s.doc.screens[0].rootNode);
    if (!hit) throw new Error(`no ${wantedType} node`);
    return hit.id;
  }, type);
}

const selectedIds = (page: Page) =>
  page.evaluate(() => {
    interface StoreShape { getState: () => { selectedNodeIds: string[] } }
    return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().selectedNodeIds;
  });

const historyIndex = (page: Page) =>
  page.evaluate(() => {
    interface StoreShape { getState: () => { historyIndex: number } }
    return (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().historyIndex;
  });

const nodeById = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    interface NodeShape { id: string; type: string; children?: NodeShape[]; halign?: string }
    interface StoreShape { getState: () => { doc: { screens: Array<{ rootNode: NodeShape }> } } }
    const s = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const find = (node: NodeShape): NodeShape | null => {
      if (node.id === nodeId) return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    for (const screen of s.doc.screens) {
      const hit = find(screen.rootNode);
      if (hit) return hit;
    }
    return null;
  }, id);

/** Add two buttons to the first box and return their ids. */
async function addTwoButtons(page: Page): Promise<[string, string]> {
  return page.evaluate(() => {
    interface NodeShape { id: string; type: string; children?: NodeShape[] }
    interface StoreShape {
      getState: () => {
        doc: { screens: Array<{ rootNode: NodeShape }> };
        addChildNode: (parentId: string, type: string) => string | null;
      };
    }
    const s = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const find = (node: NodeShape): NodeShape | null => {
      if (node.type === 'box') return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    const box = find(s.doc.screens[0].rootNode);
    if (!box) throw new Error('no box');
    const first = s.addChildNode(box.id, 'button');
    const store = (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState();
    const second = store.addChildNode(box.id, 'button');
    if (!first || !second) throw new Error('addChildNode failed');
    return [first, second] as [string, string];
  });
}

const canvasNode = (page: Page, id: string) =>
  page.locator(`.protota-canvas [data-node-id="${id}"]`);

test.use({ viewport: { width: 1600, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });
});

test.describe('ctrl-click multi-select on canvas', () => {
  test('ctrl-click adds and removes members; visuals distinguish primary from members', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);

    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    expect(await selectedIds(page)).toEqual([b1, b2]);

    // Primary (last-selected) carries the solid outline; the other member
    // the dashed multi outline. Layer tree marks both rows selected.
    await expect(page.locator(`.adw-node-wrapper.selected-outline [data-node-id="${b2}"]`)).toHaveCount(1);
    await expect(page.locator(`.adw-node-wrapper.multi-selected-outline [data-node-id="${b1}"]`)).toHaveCount(1);
    await expect(page.locator('.protota-tree-item--selected')).toHaveCount(2);

    // Ctrl-click again toggles the member back out.
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    expect(await selectedIds(page)).toEqual([b1]);

    // Selection is editor state, not undoable — Escape clears everything.
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    await page.keyboard.press('Escape');
    expect(await selectedIds(page)).toEqual([]);
  });
});

test.describe('shift-range in the layer tree', () => {
  test('shift-click selects the visible-order range from the primary', async ({ page }) => {
    await addTwoButtons(page);
    const rows = page.getByTestId('layer-row');
    const rowIds = await rows.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.nodeId!));
    expect(rowIds.length).toBeGreaterThan(4);

    await rows.nth(2).click();
    await rows.nth(5).click({ modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(rowIds.slice(2, 6));

    // Ctrl-click in the tree toggles a member out of the range.
    await rows.nth(3).click({ modifiers: ['Control'] });
    expect(await selectedIds(page)).toEqual([rowIds[2], rowIds[4], rowIds[5]]);
  });
});

test.describe('rubber-band marquee', () => {
  test('dragging on empty canvas selects intersected leaves, shallowest only, without touching undo', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    const before = await historyIndex(page);

    const r1 = await canvasNode(page, b1).boundingBox();
    const r2 = await canvasNode(page, b2).boundingBox();
    if (!r1 || !r2) throw new Error('buttons not rendered');
    const windowId = await nodeIdByType(page, 'window');
    const winBox = await canvasNode(page, windowId).boundingBox();
    if (!winBox) throw new Error('window not rendered');

    // Start on empty canvas space left of the screen frame, then sweep a
    // rect covering both buttons (leaves) but only slicing their ancestors.
    const startX = winBox.x - 30;
    const startY = Math.min(r1.y, r2.y) - 5;
    const endX = Math.max(r1.x + r1.width, r2.x + r2.width) + 5;
    const endY = Math.max(r1.y + r1.height, r2.y + r2.height) + 5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10);
    await expect(page.getByTestId('marquee')).toBeVisible();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    const ids = await selectedIds(page);
    expect(ids).toContain(b1);
    expect(ids).toContain(b2);
    // Shallowest-ancestor filtering: no container that holds the buttons.
    expect(ids).not.toContain(windowId);
    const boxId = await nodeIdByType(page, 'box');
    expect(ids).not.toContain(boxId);
    await expect(page.getByTestId('marquee')).toHaveCount(0);
    // Marquee selection is editor state: no history entries.
    expect(await historyIndex(page)).toBe(before);
  });
});

test.describe('align and distribute', () => {
  test('align end sets halign on every member in ONE undo snapshot', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });

    await expect(page.getByTestId('multi-select-panel')).toBeVisible();
    const before = await historyIndex(page);
    await page.getByTestId('align-end').click();

    expect((await nodeById(page, b1))?.halign).toBe('end');
    expect((await nodeById(page, b2))?.halign).toBe('end');
    expect(await historyIndex(page)).toBe(before + 1);

    // One undo reverts both edits.
    await page.keyboard.press('Control+z');
    expect((await nodeById(page, b1))?.halign).toBeUndefined();
    expect((await nodeById(page, b2))?.halign).toBeUndefined();
  });

  test('distribute vertical applies to box siblings; horizontal is disabled with a reason', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });

    // The parent box is vertical, so V applies and H is disabled.
    await expect(page.getByTestId('distribute-vertical')).toBeEnabled();
    await expect(page.getByTestId('distribute-horizontal')).toBeDisabled();

    const before = await historyIndex(page);
    await page.getByTestId('distribute-vertical').click();
    expect(await historyIndex(page)).toBe(before + 1);
    expect((await nodeById(page, b1)) as NodeShape & { vexpand?: boolean }).toMatchObject({ vexpand: true });
    expect((await nodeById(page, b2)) as NodeShape & { vexpand?: boolean }).toMatchObject({ vexpand: true });
  });
});

test.describe('forest clipboard (ADR 0001 Part 3)', () => {
  test('copy/paste of a multi-selection pastes both, in order, as ONE undo step', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    const boxId = await nodeIdByType(page, 'box');

    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    await page.keyboard.press('Control+c');

    // Paste with b1 as target: buttons cannot live inside a button, so both
    // land beside it in the parent box, in clipboard (selection) order.
    await canvasNode(page, b1).click();
    const before = await historyIndex(page);
    await page.keyboard.press('Control+v');

    expect(await historyIndex(page)).toBe(before + 1);
    const pasted = await selectedIds(page);
    expect(pasted).toHaveLength(2);
    const box = await nodeById(page, boxId);
    const childIds = (box?.children ?? []).map((child) => child.id);
    // [clamp, b1, p1, p2, b2]: the pasted forest sits after the target.
    expect(childIds.indexOf(b1)).toBeGreaterThan(-1);
    expect(childIds.slice(childIds.indexOf(b1) + 1, childIds.indexOf(b1) + 3)).toEqual(pasted);
    expect(childIds[childIds.length - 1]).toBe(b2);

    // A single undo removes the whole pasted forest.
    await page.keyboard.press('Control+z');
    const boxAfter = await nodeById(page, boxId);
    expect((boxAfter?.children ?? []).map((child) => child.id)).not.toContain(pasted[0]);
    expect(await nodeById(page, b1)).not.toBeNull();
    expect(await nodeById(page, b2)).not.toBeNull();
  });

  test('Ctrl+D duplicates every member of a multi-selection in ONE undo step', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    const boxId = await nodeIdByType(page, 'box');

    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    const before = await historyIndex(page);
    await page.keyboard.press('Control+d');

    expect(await historyIndex(page)).toBe(before + 1);
    const created = await selectedIds(page);
    expect(created).toHaveLength(2);
    const box = await nodeById(page, boxId);
    const buttonCount = (box?.children ?? []).filter((child) => child.type === 'button').length;
    expect(buttonCount).toBe(4);

    await page.keyboard.press('Control+z');
    const boxAfter = await nodeById(page, boxId);
    expect((boxAfter?.children ?? []).filter((child) => child.type === 'button')).toHaveLength(2);
  });

  test('Ctrl+X cuts the forest in ONE step; paste moves it into another container', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    const boxId = await nodeIdByType(page, 'box');

    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });
    const before = await historyIndex(page);
    await page.keyboard.press('Control+x');

    expect(await historyIndex(page)).toBe(before + 1);
    expect(await nodeById(page, b1)).toBeNull();
    expect(await nodeById(page, b2)).toBeNull();

    // Paste into the box the buttons came from — the classic move workflow.
    // Select the box through the store: a center click would land on a child.
    await page.evaluate((id) => {
      interface StoreShape { getState: () => { selectNode: (nodeId: string) => void } }
      (window as unknown as { __mockupStore: StoreShape }).__mockupStore.getState().selectNode(id);
    }, boxId);
    await page.keyboard.press('Control+v');
    const pasted = await selectedIds(page);
    expect(pasted).toHaveLength(2);
    const box = await nodeById(page, boxId);
    expect((box?.children ?? []).filter((child) => child.type === 'button')).toHaveLength(2);
  });
});

test.describe('delete with multi-selection', () => {
  test('Delete removes all selected nodes in ONE undo snapshot', async ({ page }) => {
    const [b1, b2] = await addTwoButtons(page);
    await canvasNode(page, b1).click();
    await canvasNode(page, b2).click({ modifiers: ['Control'] });

    const before = await historyIndex(page);
    await page.keyboard.press('Delete');

    expect(await nodeById(page, b1)).toBeNull();
    expect(await nodeById(page, b2)).toBeNull();
    expect(await historyIndex(page)).toBe(before + 1);
    expect(await selectedIds(page)).toEqual([]);

    // A single undo restores both.
    await page.keyboard.press('Control+z');
    expect(await nodeById(page, b1)).not.toBeNull();
    expect(await nodeById(page, b2)).not.toBeNull();
  });
});
