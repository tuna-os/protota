import { test, expect, type Page } from '@playwright/test';

/**
 * Flow curves must follow a screen while it is being resized.
 *
 * A resize drag changes the frame size through `resizePreview` and commits
 * the document only on pointerup, so curves drawn from the pre-drag geometry
 * are visibly wrong mid-gesture. This spec asserts on the path data during
 * the drag, which the unit-level hook test cannot see.
 */

// Wide viewport so both frames and the right-edge handle are on screen.
test.use({ viewport: { width: 1700, height: 950 } });

const flowDocument = {
  id: 'flow-resize-doc',
  title: 'Flow Resize Fixture',
  colorScheme: 'auto',
  edges: [{ id: 'edge-1', sourceId: 'screen-a', targetId: 'screen-b' }],
  screens: [
    {
      id: 'screen-a', title: 'Alpha', type: 'standard', width: 600, height: 500,
      rootNode: {
        id: 'root-a', type: 'window',
        children: [{
          id: 'tv-a', type: 'toolbar-view',
          children: [
            { id: 'hdr-a', type: 'header-bar', slot: 'top', title: 'Alpha', children: [] },
            { id: 'content-a', type: 'box', slot: 'content', orientation: 'vertical', spacing: 12, children: [] },
          ],
        }],
      },
    },
    {
      id: 'screen-b', title: 'Beta', type: 'standard', width: 600, height: 500,
      rootNode: {
        id: 'root-b', type: 'window',
        children: [{
          id: 'tv-b', type: 'toolbar-view',
          children: [
            { id: 'hdr-b', type: 'header-bar', slot: 'top', title: 'Beta', children: [] },
            { id: 'content-b', type: 'box', slot: 'content', orientation: 'vertical', spacing: 12, children: [] },
          ],
        }],
      },
    },
  ],
};

async function seedFlowDocument(page: Page) {
  await page.goto('/');
  await page.evaluate((doc) => {
    localStorage.clear();
    localStorage.setItem('protota_doc_v1', JSON.stringify(doc));
  }, flowDocument);
  await page.reload();
  await page.waitForSelector('adw-window', { timeout: 10000 });
  // Flows are hidden by default; the overlay only exists while toggled on.
  await page.getByRole('button', { name: /flow/i }).click();
}

/** The first coordinate pair of the rendered flow path's `d` attribute. */
const pathStartX = (page: Page) =>
  page.locator('.protota-flow-overlay path[marker-end]').first().evaluate((el) => {
    const d = el.getAttribute('d') ?? '';
    return Number.parseFloat(d.replace('M ', '').split(' ')[0]!);
  });

test.describe('flow edges follow a screen resize', () => {
  test('the curve re-anchors while the frame is still being dragged', async ({ page }) => {
    await seedFlowDocument(page);

    const edge = page.locator('.protota-flow-overlay path[marker-end]');
    await expect(edge).toHaveCount(1);
    const before = await pathStartX(page);

    const handle = page.getByTestId('resize-right-screen-a');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
    // Still mid-gesture: the size chip is up and no pointerup has committed.
    await expect(page.getByTestId('resize-size-chip-screen-a')).toBeVisible();
    const midDrag = await pathStartX(page);
    await page.mouse.up();

    // The curve starts at the source frame's right edge. A wider frame moves
    // that point right before the new size reaches the document.
    expect(midDrag).toBeGreaterThan(before + 50);
  });
});
