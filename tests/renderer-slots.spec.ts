import { expect, test } from '@playwright/test';

async function loadPreset(page: import('@playwright/test').Page, id: string) {
  await page.goto('/');
  await page.evaluate(async (presetId) => {
    const response = await fetch(`./presets/${presetId}.mockup.json`);
    const preset = await response.json();
    localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
  }, id);
  await page.reload();
}

test('renderer infers structural slots for header bars and split views', async ({ page }) => {
  await loadPreset(page, 'files');

  const surface = page.locator('[data-protota-render-surface="true"]');
  const split = surface.locator('adw-overlay-split-view');
  await expect(split.locator('.adw-osv-sidebar')).toContainText('Home');
  await expect(split.locator('.adw-osv-content')).toContainText('Desktop');
  await expect(split.locator('.adw-osv-sidebar')).toBeVisible();

  const headers = surface.locator('adw-header-bar');
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(1).locator('.adw-header-bar-start')).toContainText('Back');
  await expect(headers.nth(1).locator('.adw-header-bar-center adw-entry')).toHaveAttribute('value', 'Home');
  await expect(headers.nth(1).locator('.adw-header-bar-end')).toContainText('New Folder');
});

test('renderer preserves GtkBox orientation from the document model', async ({ page }) => {
  await loadPreset(page, 'calculator');

  const keypadRow = page.locator('[data-protota-type="box"][orientation="horizontal"]').first();
  await expect(keypadRow).toHaveCSS('flex-direction', 'row');
  await expect(keypadRow.getByRole('button')).toHaveCount(5);
});
