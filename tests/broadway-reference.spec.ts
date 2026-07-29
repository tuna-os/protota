import { expect, test } from '@playwright/test';

const broadwayUrl = process.env.BROADWAY_URL;
const presetId = process.env.BROADWAY_PRESET_ID || 'calculator';
const appId = process.env.BROADWAY_APP_ID || presetId;
const viewport = {
  width: Number(process.env.BROADWAY_VIEWPORT_WIDTH || 410),
  height: Number(process.env.BROADWAY_VIEWPORT_HEIGHT || 666),
};

test.describe('Broadway reference captures', () => {
  test.skip(!broadwayUrl, 'Set BROADWAY_URL to run the native GTK reference capture.');

  test('captures the native GNOME app and its matching Protota preset', async ({ browser, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(async (id) => {
      const response = await fetch(`./presets/${id}.mockup.json`);
      const preset = await response.json();
      localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
    }, presetId);
    await page.reload();
    await expect(page.locator('adw-window')).toBeVisible();
    await testInfo.attach(`protota-${appId}.png`, { body: await page.screenshot(), contentType: 'image/png' });

    const referencePage = await browser.newPage({ viewport });
    await referencePage.goto(broadwayUrl!);
    await referencePage.waitForTimeout(2_000);
    await testInfo.attach(`broadway-${appId}.png`, { body: await referencePage.screenshot(), contentType: 'image/png' });
    await referencePage.close();
  });
});
