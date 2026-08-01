import { test, expect, type Page } from '@playwright/test';

/**
 * Adwaita spacing-scale snapping (#79, docs/penpot-study.md §5): the
 * inspector's spacing fields step along the 6/12/18/24 scale HIG-W001
 * enforces, the drop indicator badges the spacing a drop will inherit (with
 * the linter's warning tint when it is off-scale), and an off-scale drop
 * offers the diagnostic's nearest-scale fix as a transient chip.
 */

declare global {
  interface Window {
    __mockupStore: {
      getState: () => {
        doc: { screens: Array<{ id: string; rootNode: unknown }> };
        historyIndex: number;
        selectNode: (nodeId: string | null, screenId?: string) => void;
        updateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
        undo: () => void;
      };
    };
  }
}

/** First box in the first screen; optionally force its spacing first. */
async function firstBox(page: Page, spacing?: number): Promise<string> {
  return page.evaluate((wanted) => {
    const state = window.__mockupStore.getState();
    type Node = { id: string; type: string; children?: Node[] };
    const findBox = (node: Node): Node | null => {
      if (node.type === 'box') return node;
      for (const child of node.children ?? []) {
        const found = findBox(child);
        if (found) return found;
      }
      return null;
    };
    const box = findBox(state.doc.screens[0].rootNode as Node);
    if (!box) throw new Error('no box node in default document');
    if (wanted !== undefined) state.updateNodeProps(box.id, { spacing: wanted });
    return box.id;
  }, spacing);
}

async function boxSpacing(page: Page, boxId: string): Promise<number | undefined> {
  return page.evaluate((id) => {
    const state = window.__mockupStore.getState();
    type Node = { id: string; type: string; spacing?: number; children?: Node[] };
    const find = (node: Node): Node | null => {
      if (node.id === id) return node;
      for (const child of node.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    for (const screen of state.doc.screens) {
      const hit = find(screen.rootNode as Node);
      if (hit) return hit.spacing;
    }
    throw new Error('box not found');
  }, boxId);
}

const selectInStore = (page: Page, nodeId: string) =>
  page.evaluate((id) => {
    const state = window.__mockupStore.getState();
    state.selectNode(id, state.doc.screens[0].id);
  }, nodeId);

const historyIndex = (page: Page) =>
  page.evaluate(() => window.__mockupStore.getState().historyIndex);

/**
 * Drag a palette widget over (and optionally onto) a canvas node.
 * `midDrag` runs after dragover while the indicator is still live.
 */
async function paletteDrag(
  page: Page, widgetType: string, targetId: string, drop: boolean,
  midDrag?: () => Promise<void>,
) {
  await page.getByTestId('left-tab-widgets').click();
  const entry = page.locator(`[data-testid="palette-item"][data-widget-type="${widgetType}"]`);
  await expect(entry).toBeVisible();
  const target = page.locator(`.protota-canvas [data-node-id="${targetId}"]`);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await entry.dispatchEvent('dragstart', { dataTransfer });
  const box = await target.boundingBox();
  if (!box) throw new Error('target has no box');
  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  await target.dispatchEvent('dragover', { dataTransfer, clientX, clientY });
  if (midDrag) await midDrag();
  if (drop) await target.dispatchEvent('drop', { dataTransfer, clientX, clientY });
  await entry.dispatchEvent('dragend', { dataTransfer });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('adw-window', { timeout: 15000 });
});

test.describe('inspector spacing-scale field', () => {
  test('steppers walk the Adwaita scale instead of ±1', async ({ page }) => {
    const boxId = await firstBox(page, 12);
    await selectInStore(page, boxId);

    const field = page.getByTestId('spacing-snap-spacing');
    await expect(field).toBeVisible();
    await expect(field.locator('input')).toHaveValue('12');

    await page.getByTestId('spacing-step-up-spacing').click();
    await expect(field.locator('input')).toHaveValue('18');
    expect(await boxSpacing(page, boxId)).toBe(18);

    await page.getByTestId('spacing-step-down-spacing').click();
    await page.getByTestId('spacing-step-down-spacing').click();
    await expect(field.locator('input')).toHaveValue('10');
    expect(await boxSpacing(page, boxId)).toBe(10);
  });

  test('arrow keys snap to the scale, typing stays free', async ({ page }) => {
    const boxId = await firstBox(page, 13);
    await selectInStore(page, boxId);
    const input = page.getByTestId('spacing-snap-spacing').locator('input');

    // Off-scale start: one keypress lands on scale.
    await input.press('ArrowUp');
    await expect(input).toHaveValue('18');

    // Typed values are never coerced — enforcement stays with the linter.
    await input.fill('13');
    await expect(input).toHaveValue('13');
    expect(await boxSpacing(page, boxId)).toBe(13);

    // The off-scale affordance offers the linter's nearest value.
    const offScale = page.getByTestId('spacing-off-scale-spacing');
    await expect(offScale).toContainText('snap to 12px');
    await offScale.click();
    expect(await boxSpacing(page, boxId)).toBe(12);
    await expect(offScale).toBeHidden();
  });
});

test.describe('drop-indicator spacing badge', () => {
  test('shows the spacing the drop inherits, warning tint when off-scale', async ({ page }) => {
    const boxId = await firstBox(page, 12);

    const badge = page.getByTestId('dnd-spacing-badge');
    await paletteDrag(page, 'button', boxId, false, async () => {
      await expect(badge).toHaveText('12px');
      await expect(badge).toHaveAttribute('data-off-scale', 'false');
    });
    // Abandoning the drag clears the badge with the rest of the indicator.
    await expect(badge).toBeHidden();

    await firstBox(page, 13);
    await paletteDrag(page, 'button', boxId, false, async () => {
      await expect(badge).toHaveText('13px ⚠');
      await expect(badge).toHaveAttribute('data-off-scale', 'true');
    });
  });
});

test.describe('post-drop quantise chip', () => {
  test('off-scale drop offers the nearest scale value; applying is one undo step', async ({ page }) => {
    const boxId = await firstBox(page, 13);

    await paletteDrag(page, 'button', boxId, true);
    const chip = page.getByTestId('quantise-hint');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('13px');

    const before = await historyIndex(page);
    await page.getByTestId('quantise-apply').click();
    await expect(chip).toBeHidden();
    expect(await boxSpacing(page, boxId)).toBe(12);
    expect(await historyIndex(page)).toBe(before + 1);

    // One undo step restores the off-scale value, not the drop.
    await page.evaluate(() => window.__mockupStore.getState().undo());
    expect(await boxSpacing(page, boxId)).toBe(13);
  });

  test('on-scale drops offer nothing; dismiss clears the chip', async ({ page }) => {
    const boxId = await firstBox(page, 12);
    await paletteDrag(page, 'button', boxId, true);
    await expect(page.getByTestId('quantise-hint')).toHaveCount(0);

    await firstBox(page, 13);
    await paletteDrag(page, 'button', boxId, true);
    await expect(page.getByTestId('quantise-hint')).toBeVisible();
    await page.getByTestId('quantise-dismiss').click();
    await expect(page.getByTestId('quantise-hint')).toHaveCount(0);
  });
});
