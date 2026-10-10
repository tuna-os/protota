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
  const ids = await page.evaluate(() => {
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
  // Adding Details steals the canvas focus; the flow tests start from Home.
  await page.getByTitle('Previous Screen').click();
  return ids;
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

    // A phone shell has no window decorations: the renderer's
    // minimize/maximize/close controls are hidden in the phone frame.
    await expect(overlay.locator('.protota-window-controls').first()).toBeHidden();

    // The app fills the frame responsively — no fixed authored size
    // pinning it wider than the phone.
    const phoneFrame = overlay.locator('.protota-phosh-phone-frame');
    const overflowX = await phoneFrame.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);

    // The floating chrome chips (screen title picker etc.) never overlap
    // the phone — even after shrinking the browser window vertically.
    const assertNoOverlap = async () => {
      const chromeBox = (await overlay.locator('.protota-preview-chrome--start').boundingBox())!;
      const frameBox = (await phoneFrame.boundingBox())!;
      expect(frameBox.y).toBeGreaterThanOrEqual(chromeBox.y + chromeBox.height - 1);
    };
    await assertNoOverlap();
    await page.setViewportSize({ width: 1000, height: 480 });
    await assertNoOverlap();

    // Phosh status bar: wifi + bluetooth left, clock centred, silent +
    // charged battery right — preview chrome, not document content.
    const statusBar = overlay.getByTestId('phosh-status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar.locator('.protota-phosh-status-clock')).toContainText(/\d{1,2}:\d{2}/);
    const leftSide = statusBar.locator('.protota-phosh-status-side').first();
    await expect(leftSide.getByTestId('phosh-status-wifi')).toBeVisible();
    await expect(leftSide.getByTestId('phosh-status-bluetooth')).toBeVisible();
    const rightSide = statusBar.locator('.protota-phosh-status-side').last();
    await expect(rightSide.getByTestId('phosh-status-silent')).toBeVisible();
    await expect(rightSide.getByTestId('phosh-status-battery')).toBeVisible();

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

    // …while the desktop preview keeps its window decorations and has no
    // phone status bar.
    await expect(overlay.locator('.protota-window-controls').first()).toBeVisible();
    await expect(overlay.getByTestId('phosh-status-bar')).toHaveCount(0);

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
    await overlay.locator('gtk-button', { hasText: 'Open Details' }).click();
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
    await overlay.getByTestId('preview-screen-select').click();
    const menu = page.getByTestId('preview-screen-menu');
    await expect(menu).toBeVisible();
    // The surface stays inside the viewport under the trigger — no
    // cropping past the left edge — and centers under it.
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    const viewport = page.viewportSize()!;
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    // No clock or interpunct in the phone trigger: title only.
    const picker = overlay.getByTestId('preview-screen-select');
    await expect(picker).not.toContainText('•');
    await expect(picker).not.toContainText(/\d{1,2}:\d{2}/);
    // Centered in the preview header row.
    const pickerBox = (await picker.boundingBox())!;
    const pickerCenter = pickerBox.x + pickerBox.width / 2;
    expect(Math.abs(pickerCenter - viewport.width / 2)).toBeLessThanOrEqual(3);
    // And the popover centers under it rather than opening leftward.
    const menuCenter = menuBox.x + menuBox.width / 2;
    expect(Math.abs(menuCenter - pickerCenter)).toBeLessThanOrEqual(3);
    await menu.getByRole('menuitem', { name: /Details/ }).click();
    await expect(overlay).toHaveAttribute('data-preview-screen', detailsId);
  });

  test('desktop top bar mirrors the GNOME shell', async ({ page }) => {
    const { detailsId } = await seedFlowDocument(page);

    await page.getByTitle('Toggle Desktop Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    const topbar = overlay.locator('.protota-gnome-topbar');
    await expect(topbar).toBeVisible();
    // The shell floats above the previewed window (regression guard: the
    // switcher popover was rendering behind the window header bar).
    await expect(topbar).toHaveCSS('z-index', '2000');

    // Left: static workspace indicator — one pill for the active screen,
    // filled dots for the rest — instead of the old "Activities" text.
    await expect(topbar).not.toContainText('Activities');
    const indicator = topbar.getByTestId('workspace-indicator');
    await expect(indicator).toBeVisible();
    const pill = indicator.locator('.protota-workspace-pill');
    const dot = indicator.locator('.protota-workspace-dot');
    await expect(pill).toHaveCount(1);
    await expect(dot).toHaveCount(1);
    await expect(pill).toHaveCSS('width', '28px');
    await expect(pill).toHaveCSS('height', '8px');
    await expect(dot).toHaveCSS('width', '8px');
    await expect(dot).toHaveCSS('height', '8px');
    await expect(dot).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.55)');

    // No step buttons: the clock owns screen switching now.
    await expect(topbar.getByTestId('preview-prev-screen')).toHaveCount(0);
    await expect(topbar.getByTestId('preview-next-screen')).toHaveCount(0);

    // Center: the clock trigger shows `time • title`, is absolutely
    // centred and bold.
    const clock = topbar.getByTestId('desktop-clock');
    await expect(clock).toContainText(/\d{1,2}:\d{2}/);
    await expect(clock).toContainText('•');
    await expect(clock).toHaveCSS('font-weight', '700');
    const topbarBox = (await topbar.boundingBox())!;
    const clockBox = (await clock.boundingBox())!;
    const topbarCenter = topbarBox.x + topbarBox.width / 2;
    const clockCenter = clockBox.x + clockBox.width / 2;
    expect(Math.abs(clockCenter - topbarCenter)).toBeLessThanOrEqual(2);

    // The clock is the switcher trigger: its Adwaita popover lists the
    // screens and jumps on activation.
    await topbar.getByTestId('preview-screen-select').click();
    const menu = page.getByTestId('preview-screen-menu');
    await expect(menu).toBeVisible();
    // Desktop: the surface is centered under the clock trigger.
    const triggerBox = (await topbar.getByTestId('preview-screen-select').boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    const triggerCenter = triggerBox.x + triggerBox.width / 2;
    const menuCenter = menuBox.x + menuBox.width / 2;
    expect(Math.abs(menuCenter - triggerCenter)).toBeLessThanOrEqual(3);
    await expect(menu.getByRole('menuitem', { name: /Details/ })).toBeVisible();
    await menu.getByRole('menuitem', { name: /Details/ }).click();
    await expect(overlay).toHaveAttribute('data-preview-screen', detailsId);
    await expect(clock).toContainText(/•\s*Details/);

    // Right: system status section (wireless + bluetooth + battery) before
    // the exit chip.
    await expect(topbar.getByTestId('desktop-status-wireless')).toBeVisible();
    await expect(topbar.getByTestId('desktop-status-bluetooth')).toBeVisible();
    await expect(topbar.getByTestId('desktop-status-battery')).toBeVisible();
    const statusBox = (await topbar.locator('.protota-gnome-status-icons').boundingBox())!;
    const exitBox = (await topbar.getByTestId('preview-exit').boundingBox())!;
    expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(exitBox.x);
  });

  test('workspace indicator caps at five with end-anchored pill', async ({ page }) => {
    await seedFlowDocument(page);
    // Grow to 6 screens. Adding all four inside one evaluate is a single
    // React batch, so the canvas focuses the FIRST new screen (its
    // "newly added" effect matches one added id), not the last. Navigate
    // explicitly below rather than assuming which one won focus.
    await page.evaluate(() => {
      const store = (window as unknown as { __mockupStore: { getState: () => {
        addScreen: (title: string, kind: string) => void;
        selectNode: (id: null) => void;
      } } }).__mockupStore.getState();
      for (let i = 0; i < 4; i++) store.addScreen(`Extra ${i}`, 'standard');
      store.selectNode(null);
    });

    await page.getByTitle('Toggle Desktop Preview').click();
    const overlay = page.getByTestId('preview-overlay');
    const topbar = overlay.locator('.protota-gnome-topbar');
    const indicator = topbar.getByTestId('workspace-indicator');
    const slots = indicator.locator(':scope > *');

    const jumpTo = async (name: RegExp) => {
      await topbar.getByTestId('preview-screen-select').click();
      const menu = page.getByTestId('preview-screen-menu');
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name }).click();
      await expect(overlay).toHaveAttribute('data-preview-screen', /\w+/);
    };

    // On the very last screen: 5 slots, pill on the end.
    await jumpTo(/^6: /);
    await expect(slots).toHaveCount(5);
    await expect(indicator.locator(':scope > :last-child')).toHaveClass(/protota-workspace-pill/);

    // On the very first screen: still 5 slots, pill at the start.
    await jumpTo(/^1: /);
    await expect(slots).toHaveCount(5);
    await expect(indicator.locator(':scope > :first-child')).toHaveClass(/protota-workspace-pill/);

    // In the middle: pill interior, dots on both ends.
    await jumpTo(/^3: /);
    await expect(slots).toHaveCount(5);
    await expect(indicator.locator(':scope > :first-child')).toHaveClass(/protota-workspace-dot/);
    await expect(indicator.locator(':scope > :last-child')).toHaveClass(/protota-workspace-dot/);
    await expect(indicator.locator('.protota-workspace-pill')).toHaveCount(1);
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
    await expect(bar.getByTitle('Toggle Desktop Preview')).not.toBeVisible();
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
