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
