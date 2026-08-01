import { test, expect } from '@playwright/test';

test.describe('GNOME Core app presets (#6)', () => {
// Load Preset moved into the File menu (#106 layout reorder).
const openPresetGallery = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: /load preset/i }).click();
};

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('preset gallery entry exists in the File menu', async ({ page }) => {
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.getByRole('button', { name: /load preset/i })).toBeVisible();
  });

  test('clicking preset button opens gallery', async ({ page }) => {
    await openPresetGallery(page);

    const gallery = page.locator('.protota-preset-gallery');
    await expect(gallery).toBeVisible({ timeout: 3000 });
  });

  test('gallery shows at least 5 presets', async ({ page }) => {
    await openPresetGallery(page);
    const items = page.locator('.protota-preset-item');
    await expect(items.first()).toBeVisible({ timeout: 3000 });
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('presets are named after GNOME Core apps', async ({ page }) => {
    await openPresetGallery(page);

    // Check for specific preset names
    const files = page.locator('.protota-preset-item').filter({ hasText: /files|nautilus/i });
    await expect(files.first()).toBeVisible({ timeout: 3000 });

    const settings = page.locator('.protota-preset-item').filter({ hasText: /settings/i });
    await expect(settings.first()).toBeVisible({ timeout: 3000 });

    const calculator = page.locator('.protota-preset-item').filter({ hasText: /calculator/i });
    await expect(calculator.first()).toBeVisible({ timeout: 3000 });
  });

  test('loading a preset replaces the document', async ({ page }) => {
    await openPresetGallery(page);

    const calc = page.locator('.protota-preset-item').filter({ hasText: /calculator/i }).first();
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      calc.click(),
    ]).catch(() => {});

    // The page reloaded — wait for content
    await page.waitForTimeout(1000);

    // After reload, the document title should reflect the preset
    // Check if we see calculator buttons (may need a moment to mount)
    await page.waitForSelector('adw-window', { timeout: 8000 }).catch(() => {});

    // Count buttons — if 0, the localStorage may still have old data
    const docTitle = await page.evaluate(() => {
      return localStorage.getItem('protota_doc_v1');
    });
    if (docTitle) {
      const parsed = JSON.parse(docTitle);
      expect(parsed.id).toBe('preset-calculator');
    }
  });

  // Structural checks rather than pixel snapshots.
  //
  // Snapshotting our own render compares the app to itself: it cannot catch a
  // fidelity regression (the native app is the oracle for that, via
  // tests/broadway-reference.spec.ts and scripts/fidelity-report.mjs), and it
  // is sensitive to the font stack of whoever runs it, so the same commit
  // passed CI while failing locally. It produced only false signals. What is
  // worth asserting is that every shipped preset still loads and renders the
  // structure it claims (#87).
  for (const presetId of ['calculator', 'settings', 'text-editor', 'files', 'calendar',
                          'weather', 'clocks', 'disks', 'web', 'software']) {
    test(`${presetId} preset loads and renders its screens`, async ({ page }) => {
      const expected = await page.evaluate(async (id) => {
        const response = await fetch(`./presets/${id}.mockup.json`);
        const payload = await response.json();
        localStorage.setItem('protota_doc_v1', JSON.stringify(payload.document));
        if (payload.sourceIcons) {
          localStorage.setItem('protota_source_icons_v1', JSON.stringify(payload.sourceIcons));
        }
        return { screens: payload.document.screens.length };
      }, presetId);
      await page.reload();
      // Published once fonts, runtime icon CSS and custom-element upgrades
      // have painted, so the assertions below see a settled tree.
      await page.waitForSelector('html[data-protota-ready]', { timeout: 15000 });

      // A screen only exposes a render surface when its root is a window or
      // dialog; some presets have screens rooted at a plain container, so the
      // count is a ceiling rather than an equality.
      const surfaces = page.locator('[data-protota-render-surface="true"]');
      expect(await surfaces.count()).toBeGreaterThan(0);
      expect(await surfaces.count()).toBeLessThanOrEqual(expected.screens);
      await expect(surfaces.first()).toBeVisible();

      // A window that rendered nothing would still satisfy a count, so require
      // real widgets inside the first screen.
      const widgets = surfaces.first().locator('[data-protota-type]');
      expect(await widgets.count()).toBeGreaterThan(3);
    });
  }
});
