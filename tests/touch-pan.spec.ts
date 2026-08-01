import { test, expect, type Page } from '@playwright/test';

// Touch support on the viewport canvas: two-finger pan, pinch zoom, and the
// small-viewport initial fit. Runs in a touch-enabled mobile-sized context;
// multi-touch is driven through CDP (Playwright has no multi-touch API).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

interface Point {
  x: number;
  y: number;
}

/** Current surface transform: matrix(a,·,·,·,e,f) → scale + translation. */
const surfaceMatrix = (page: Page) =>
  page.locator('.protota-canvas-surface').evaluate((el) => {
    const t = getComputedStyle(el).transform;
    const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
    return { scale: m.a, x: m.e, y: m.f };
  });

/** Drive a two-finger gesture from `from` to `to` in interpolated steps. */
async function twoFingerGesture(
  page: Page,
  from: [Point, Point],
  to: [Point, Point],
  steps = 10,
) {
  const cdp = await page.context().newCDPSession(page);
  const touchPoints = (pair: Point[]) =>
    pair.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id }));
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: touchPoints(from),
    });
    for (let s = 1; s <= steps; s++) {
      const pair = from.map((p, i) => ({
        x: p.x + ((to[i].x - p.x) * s) / steps,
        y: p.y + ((to[i].y - p.y) * s) / steps,
      }));
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchPoints(pair),
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

test.describe('Touch pan/zoom and small-viewport fit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.protota-canvas-surface')).toBeVisible();
  });

  test('initial load shows the screen fully inside the viewport', async ({ page }) => {
    const frame = page.locator('[data-protota-flow-screen]').first();
    await expect(frame).toBeVisible();
    // Poll: the fit runs in an effect and the surface transform animates.
    await expect
      .poll(async () => {
        const b = await frame.boundingBox();
        if (!b) return 'no-box';
        const fits =
          b.x >= 0 && b.y >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844;
        return fits ? 'fits' : `off-screen: ${JSON.stringify(b)}`;
      })
      .toBe('fits');
  });

  test('two-finger drag pans the canvas without changing zoom', async ({ page }) => {
    const before = await surfaceMatrix(page);
    await twoFingerGesture(
      page,
      [{ x: 140, y: 350 }, { x: 240, y: 350 }],
      [{ x: 80, y: 430 }, { x: 180, y: 430 }],
    );
    // Midpoint moved by (-60, +80); the translation follows it 1:1.
    await expect.poll(async () => (await surfaceMatrix(page)).x - before.x).toBeLessThan(-40);
    const after = await surfaceMatrix(page);
    expect(after.y - before.y).toBeGreaterThan(40);
    expect(after.scale).toBeCloseTo(before.scale, 2);
    // The gesture is a pan, not a marquee and not a reparent drag.
    await expect(page.getByTestId('marquee')).toHaveCount(0);
  });

  test('pinch spread zooms in, and the bottom bar shows the same zoom', async ({ page }) => {
    const before = await surfaceMatrix(page);
    await twoFingerGesture(
      page,
      [{ x: 145, y: 400 }, { x: 245, y: 400 }],
      [{ x: 70, y: 400 }, { x: 320, y: 400 }],
    );
    await expect
      .poll(async () => (await surfaceMatrix(page)).scale)
      .toBeGreaterThan(before.scale * 1.5);
    const after = await surfaceMatrix(page);
    expect(after.scale).toBeLessThanOrEqual(2.5); // existing zoom ceiling
    // Pinch updates the same zoom state the bottom-bar controls display.
    await expect(page.locator('.protota-zoom-bar')).toContainText(
      `${Math.round(after.scale * 100)}%`,
    );
  });

  test('pinch close zooms out, clamped to the existing floor', async ({ page }) => {
    const before = await surfaceMatrix(page);
    await twoFingerGesture(
      page,
      [{ x: 70, y: 400 }, { x: 320, y: 400 }],
      [{ x: 180, y: 400 }, { x: 210, y: 400 }],
    );
    await expect
      .poll(async () => (await surfaceMatrix(page)).scale)
      .toBeLessThan(before.scale);
    const after = await surfaceMatrix(page);
    expect(after.scale).toBeGreaterThanOrEqual(0.3 - 1e-6);
  });

  test('single-finger tap still selects a node', async ({ page }) => {
    // Tap the mockup's header bar area (centre of the fitted screen's top).
    const frame = page.locator('[data-protota-flow-screen]').first();
    const box = (await frame.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 40);
    await expect(page.locator('.adw-node-wrapper.selected-outline')).toHaveCount(1);
  });
});
