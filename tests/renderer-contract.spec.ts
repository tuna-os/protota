import { expect, test } from '@playwright/test';

const conformanceDocument = {
  id: 'renderer-contract', title: 'Renderer contract', colorScheme: 'auto', edges: [],
  screens: [{
    id: 'screen', title: 'Grid', type: 'standard', width: 480, height: 320,
    rootNode: {
      id: 'window', type: 'window', children: [{
        id: 'toolbar', type: 'toolbar-view', children: [
          { id: 'header', type: 'header-bar', title: 'Grid', children: [] },
          { id: 'grid', type: 'grid', columns: 3, rowSpacing: 6, columnSpacing: 8, children: [
            { id: 'one', type: 'button', title: '1' },
            { id: 'two', type: 'button', title: '2' },
            { id: 'three', type: 'button', title: '3' },
          ] },
        ],
      }],
    },
  }],
};

test('generic renderer preserves GTK grid layout semantics', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), conformanceDocument);
  await page.reload();

  const grid = page.locator('[data-protota-type="grid"]');
  const header = page.locator('[data-protota-type="header-bar"]');
  await expect(grid).toBeVisible();
  // The editor wrapper owns the slot so web components can discover it as a
  // direct child; the actual GTK node remains structurally unwrapped.
  await expect(header.locator('..')).toHaveAttribute('slot', 'top');
  await expect(grid.locator('..')).toHaveAttribute('slot', 'content');
  await expect(grid).toHaveCSS('display', 'grid');
  expect(await grid.evaluate((element) => {
    const style = element as HTMLElement;
    return style.style.gridTemplateColumns === 'repeat(3, minmax(0px, 1fr))' &&
      style.style.rowGap === '6px' && style.style.columnGap === '8px';
  })).toBe(true);
  await expect(grid.getByRole('button')).toHaveCount(3);
  // A window's primary header bar carries the shell's window controls.
  await expect(header.locator('.protota-window-control')).toHaveCount(3);
  await expect(header.locator('.protota-window-control.close')).toHaveCount(1);
  expect(await page.evaluate(() => ({
    source: localStorage.getItem('protota_blueprint_v1'),
    legacy: localStorage.getItem('protota_doc_v1'),
  }))).toMatchObject({ source: expect.stringContaining('Adw.ToolbarView'), legacy: null });
});

// Adw.TabBar (#59 Wave 1): the strip derives its tabs from the linked
// tab-view's declared pages — the bar itself owns no tab content.
const tabBarDocument = {
  id: 'tab-bar-contract', title: 'Tab bar contract', colorScheme: 'auto', edges: [],
  screens: [{
    id: 'screen', title: 'Tabs', type: 'standard', width: 640, height: 400,
    rootNode: {
      id: 'window', type: 'window', children: [{
        id: 'toolbar', type: 'toolbar-view', children: [
          { id: 'header', type: 'header-bar', title: 'Tabs', slot: 'top', children: [] },
          { id: 'bar', type: 'tab-bar', slot: 'top', view: 'view', children: [] },
          { id: 'view', type: 'tab-view', slot: 'content', children: [
            { id: 'page-home', type: 'stack-page', title: 'Home', children: [] },
            { id: 'page-search', type: 'stack-page', title: 'Search', children: [] },
          ] },
        ],
      }],
    },
  }],
};

test('tab bar renders its tabs from the linked tab view pages', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), tabBarDocument);
  await page.reload();

  const bar = page.locator('[data-protota-type="tab-bar"]');
  await expect(bar).toBeVisible();
  await expect(bar.locator('..')).toHaveAttribute('slot', 'top');
  const tabs = bar.locator('.protota-tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toContainText('Home');
  await expect(tabs.nth(1)).toContainText('Search');
  // GTK selects the first page by default; only that tab carries the fill.
  await expect(tabs.nth(0)).toHaveClass(/protota-tab-active/);
  await expect(tabs.nth(1)).not.toHaveClass(/protota-tab-active/);
  // Each tab draws a close affordance, as the native strip does.
  await expect(bar.locator('.protota-tab-close')).toHaveCount(2);
});

// #59 Wave 1 (app composites): a code-defined preference row resolves to its
// Adw.ActionRow base with a code-constructed suffix — the renderer must draw
// the row chrome, the suffix widget in its slot, and a Gtk.Image bin's icon.
const projectedRowDocument = {
  id: 'projected-row-contract', title: 'Projected row contract', colorScheme: 'auto', edges: [],
  screens: [{
    id: 'screen', title: 'Preferences', type: 'standard', width: 640, height: 400,
    rootNode: {
      id: 'window', type: 'window', children: [{
        id: 'group', type: 'preferences-group', children: [
          {
            id: 'wrap', type: 'action-row', title: 'Wrap Lines', sourceClass: 'EditorPreferencesSwitch',
            children: [{ id: 'wrap-toggle', type: 'switch-widget', slot: 'suffix', children: [] }],
          },
          {
            id: 'font', type: 'action-row', title: 'Custom Font', sourceClass: 'EditorPreferencesFont',
            children: [{ id: 'font-chevron', type: 'bin', iconName: 'go-next-symbolic', slot: 'suffix', children: [] }],
          },
        ],
      }],
    },
  }],
};

test('a projected preference row renders row chrome, suffix switch, and image icon', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), projectedRowDocument);
  await page.reload();

  const wrap = page.locator('[data-protota-type="action-row"][data-node-id="wrap"]');
  await expect(wrap).toBeVisible();
  await expect(wrap).toHaveAttribute('title', 'Wrap Lines');
  // The code-constructed switch sits in the suffix slot, not as a boundary.
  const toggle = page.locator('[data-protota-type="switch-widget"][data-node-id="wrap-toggle"]');
  await expect(toggle).toHaveAttribute('data-protota-type', 'switch-widget');
  await expect(toggle.locator('..')).toHaveAttribute('slot', 'suffix');
  // A Gtk.Image imported as a bin draws its declared icon.
  const chevron = page.locator('[data-protota-type="bin"][data-node-id="font-chevron"] .adw-icon');
  await expect(chevron).toHaveClass(/adw-icon--go-next/);
});

// Dialog header bars (libadwaita AdwDialog semantics): never minimize or
// maximize; a close button only while end title buttons are enabled; and a
// header bar without its own title shows the dialog's title, centered —
// the GNOME Files compress dialog is the reference case.
const dialogHeaderDocument = {
  id: 'dialog-header-contract', title: 'Dialog header contract', colorScheme: 'auto', edges: [],
  screens: [
    {
      id: 'compress', title: 'Compress', type: 'standard', width: 440, height: 440,
      rootNode: {
        id: 'dlg', type: 'dialog', title: 'Compress Files and Folders', children: [{
          id: 'tv', type: 'toolbar-view', slot: 'child', children: [
            {
              id: 'hdr', type: 'header-bar', slot: 'top',
              showStartTitleButtons: false, showEndTitleButtons: false,
              children: [
                { id: 'cancel', type: 'button', title: 'Cancel', slot: 'start', children: [] },
                { id: 'go', type: 'button', title: 'Compress', suggested: true, slot: 'end', children: [] },
              ],
            },
            { id: 'body', type: 'preferences-page', slot: 'content', children: [] },
          ],
        }],
      },
    },
    {
      id: 'closable', title: 'Closable dialog', type: 'standard', width: 400, height: 300,
      rootNode: {
        id: 'dlg2', type: 'dialog', title: 'Closable', children: [{
          id: 'tv2', type: 'toolbar-view', slot: 'child', children: [
            { id: 'hdr2', type: 'header-bar', slot: 'top', children: [] },
            { id: 'body2', type: 'preferences-page', slot: 'content', children: [] },
          ],
        }],
      },
    },
  ],
};

test('dialog header bars show no window controls and fall back to the dialog title', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), dialogHeaderDocument);
  await page.reload();

  // Compress: both title-button sides disabled — no controls of any kind.
  const compressHeader = page.locator('adw-header-bar[data-node-id="hdr"]');
  await expect(compressHeader).toBeVisible();
  await expect(compressHeader.locator('.protota-window-control')).toHaveCount(0);
  // The dialog's title appears centered via AdwHeaderBar's title fallback.
  await expect(compressHeader).toHaveAttribute('title', 'Compress Files and Folders');
  await expect(compressHeader.locator('.adw-header-bar-center'))
    .toContainText('Compress Files and Folders');

  // Default dialog header: a close button only — never minimize/maximize.
  const closableHeader = page.locator('adw-header-bar[data-node-id="hdr2"]');
  await expect(closableHeader.locator('.protota-window-control.close')).toHaveCount(1);
  await expect(closableHeader.locator('.protota-window-control.minimize')).toHaveCount(0);
  await expect(closableHeader.locator('.protota-window-control.maximize')).toHaveCount(0);
  await expect(closableHeader).toHaveAttribute('title', 'Closable');
});

// A window header bar with show-title-buttons false draws no controls.
const controllessWindowDocument = {
  id: 'controlless-window-contract', title: 'Controlless window', colorScheme: 'auto', edges: [],
  screens: [{
    id: 'screen', title: 'Plain', type: 'standard', width: 480, height: 320,
    rootNode: {
      id: 'window', type: 'window', title: 'Plain Window', children: [{
        id: 'toolbar', type: 'toolbar-view', children: [
          { id: 'header', type: 'header-bar', showTitleButtons: false, children: [] },
          { id: 'body', type: 'box', children: [] },
        ],
      }],
    },
  }],
};

test('show-title-buttons false suppresses window controls on a window header bar', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), controllessWindowDocument);
  await page.reload();

  const header = page.locator('adw-header-bar[data-node-id="header"]');
  await expect(header).toBeVisible();
  await expect(header.locator('.protota-window-control')).toHaveCount(0);
  // The window title still appears through the header-bar fallback.
  await expect(header).toHaveAttribute('title', 'Plain Window');
});

// A GTK size request on the root window is a minimum for a window that picks
// its own size — it must never override a screen's declared size. GNOME
// Calculator's `height-request: 616` used to stretch a 460px screen to 616px,
// which broke the Broadway capture contract that renders the Protota surface
// at exactly the native window's measured size.
const oversizedRequestDocument = {
  id: 'root-size-request-contract', title: 'Root size request', colorScheme: 'auto', edges: [],
  screens: [{
    id: 'screen', title: 'Requested', type: 'standard', width: 410, height: 460,
    rootNode: {
      id: 'window', type: 'window', title: 'Requested', heightRequest: 616, widthRequest: 700, children: [{
        id: 'toolbar', type: 'toolbar-view', children: [
          { id: 'header', type: 'header-bar', title: 'Requested', children: [] },
          { id: 'body', type: 'box', children: [] },
        ],
      }],
    },
  }],
};

test('a root size request never resizes the screen surface', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((document) => localStorage.setItem('protota_doc_v1', JSON.stringify(document)), oversizedRequestDocument);
  await page.reload();

  const surface = page.locator('[data-protota-render-surface="true"]');
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  expect(Math.round(box!.width), 'width must equal the screen, not the width request').toBe(410);
  expect(Math.round(box!.height), 'height must equal the screen, not the height request').toBe(460);
});
