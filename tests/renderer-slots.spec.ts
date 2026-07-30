import { expect, test } from '@playwright/test';

/**
 * Renderer slot-inference contract, checked against synthetic documents so it
 * is independent of preset content (presets are regenerated from GNOME
 * source and change with upstream releases).
 */
async function loadDocument(page: import('@playwright/test').Page, doc: unknown) {
  await page.goto('/');
  await page.evaluate((document) => {
    localStorage.clear();
    localStorage.setItem('protota_doc_v1', JSON.stringify(document));
  }, doc);
  await page.reload();
}

test('renderer infers structural slots for header bars and split views', async ({ page }) => {
  await loadDocument(page, {
    id: 'slots-doc', title: 'Slots', colorScheme: 'auto', edges: [],
    screens: [{
      id: 's1', title: 'Main', type: 'standard', width: 900, height: 600,
      rootNode: {
        id: 'w', type: 'window', children: [{
          id: 't', type: 'toolbar-view', children: [
            { id: 'h', type: 'header-bar', children: [
              { id: 'back', type: 'button', title: 'Back' },
              { id: 'title', type: 'window-title', title: 'Documents' },
              { id: 'menu', type: 'menu-button', iconName: 'open-menu-symbolic' },
            ] },
            { id: 'split', type: 'overlay-split', children: [
              { id: 'side', type: 'list-box', children: [
                { id: 'row1', type: 'action-row', title: 'Home' },
              ] },
              { id: 'content', type: 'box', orientation: 'vertical', children: [
                { id: 'lbl', type: 'label', title: 'Desktop' },
              ] },
            ] },
          ],
        }],
      },
    }],
  });

  const surface = page.locator('[data-protota-render-surface="true"]');
  const split = surface.locator('adw-overlay-split-view');
  await expect(split.locator('.adw-osv-sidebar')).toContainText('Home');
  await expect(split.locator('.adw-osv-content')).toContainText('Desktop');
  await expect(split.locator('.adw-osv-sidebar')).toBeVisible();

  const header = surface.locator('adw-header-bar').first();
  await expect(header.locator('.adw-header-bar-start')).toContainText('Back');
});

test('renderer preserves GtkBox orientation from the document model', async ({ page }) => {
  await loadDocument(page, {
    id: 'orient-doc', title: 'Orientation', colorScheme: 'auto', edges: [],
    screens: [{
      id: 's1', title: 'Main', type: 'standard', width: 700, height: 400,
      rootNode: {
        id: 'w', type: 'window', children: [{
          id: 't', type: 'toolbar-view', children: [
            { id: 'h', type: 'header-bar', children: [] },
            { id: 'row', type: 'box', orientation: 'horizontal', spacing: 6, children: [
              { id: 'b1', type: 'button', title: '1' },
              { id: 'b2', type: 'button', title: '2' },
              { id: 'b3', type: 'button', title: '3' },
              { id: 'b4', type: 'button', title: '4' },
              { id: 'b5', type: 'button', title: '5' },
            ] },
          ],
        }],
      },
    }],
  });

  const keypadRow = page.locator('[data-protota-type="box"][orientation="horizontal"]').first();
  await expect(keypadRow).toHaveCSS('flex-direction', 'row');
  await expect(keypadRow.getByRole('button')).toHaveCount(5);
});
