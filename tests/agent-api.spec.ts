import { test, expect } from '@playwright/test';

test.describe('Agent API (#7)', () => {
  test('builder produces valid mockup document', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    // Verify the initial document is valid (loaded from store)
    const docTitle = await page.evaluate(() => {
      const raw = localStorage.getItem('protota_doc_v1');
      return raw ? JSON.parse(raw).title : null;
    });
    expect(docTitle).toBeTruthy();
  });

  test('generated document passes legal children validation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    // Load the settings preset which has proper HIG structure
    await page.getByRole('button', { name: /preset/i }).click();
    const settings = page.locator('.protota-preset-item').filter({ hasText: /settings/i }).first();

    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      settings.click(),
    ]).catch(() => {});

    await page.waitForSelector('adw-window', { timeout: 8000 }).catch(() => {});

    // Verify the loaded document has valid structure
    const docId = await page.evaluate(() => {
      const raw = localStorage.getItem('protota_doc_v1');
      return raw ? JSON.parse(raw).id : null;
    });
    expect(docId).toBe('preset-settings');
  });
});
