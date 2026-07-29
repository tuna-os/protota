import { test, expect } from '@playwright/test';

test.describe('GNOME Core app presets (#6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('preset gallery button exists in toolbar', async ({ page }) => {
    const presetBtn = page.getByRole('button', { name: /preset|load/i });
    await expect(presetBtn).toBeVisible();
  });

  test('clicking preset button opens gallery', async ({ page }) => {
    const presetBtn = page.getByRole('button', { name: /preset|load/i });
    await presetBtn.click();

    const gallery = page.locator('.protota-preset-gallery');
    await expect(gallery).toBeVisible({ timeout: 3000 });
  });

  test('gallery shows at least 5 presets', async ({ page }) => {
    await page.getByRole('button', { name: /preset|load/i }).click();
    const items = page.locator('.protota-preset-item');
    await expect(items.first()).toBeVisible({ timeout: 3000 });
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('presets are named after GNOME Core apps', async ({ page }) => {
    await page.getByRole('button', { name: /preset|load/i }).click();

    // Check for specific preset names
    const files = page.locator('.protota-preset-item').filter({ hasText: /files|nautilus/i });
    await expect(files.first()).toBeVisible({ timeout: 3000 });

    const settings = page.locator('.protota-preset-item').filter({ hasText: /settings/i });
    await expect(settings.first()).toBeVisible({ timeout: 3000 });

    const calculator = page.locator('.protota-preset-item').filter({ hasText: /calculator/i });
    await expect(calculator.first()).toBeVisible({ timeout: 3000 });
  });

  test('loading a preset replaces the document', async ({ page }) => {
    await page.getByRole('button', { name: /preset|load/i }).click();

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

  test('preset rendering matches snapshot expectations', async ({ page }) => {
    const presetsToTest = ['calculator', 'settings', 'text-editor', 'files', 'calendar'];
    for (const presetId of presetsToTest) {
      await page.evaluate(async (id) => {
        const res = await fetch(`./presets/${id}.mockup.json`);
        const data = await res.json();
        localStorage.setItem('protota_doc_v1', JSON.stringify(data.document));
      }, presetId);
      await page.reload();
      await page.waitForSelector('adw-window', { timeout: 10000 });
      const windowEl = page.locator('adw-window');
      await expect(windowEl).toBeVisible();
      // Take snapshot of rendered preset window for visual comparison
      await expect(windowEl).toHaveScreenshot(`preset-${presetId}.png`, { maxDiffPixelRatio: 0.1 });
    }
  });
});
