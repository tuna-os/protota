import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const broadwayUrl = process.env.BROADWAY_URL;
const presetId = process.env.BROADWAY_PRESET_ID || 'calculator';
const appId = process.env.BROADWAY_APP_ID || presetId;
const viewport = {
  width: Number(process.env.BROADWAY_VIEWPORT_WIDTH || 410),
  height: Number(process.env.BROADWAY_VIEWPORT_HEIGHT || 666),
};

test.describe('Broadway reference captures', () => {
  test.skip(!broadwayUrl, 'Set BROADWAY_URL to run the native GTK reference capture.');

  test('compares the native GNOME app with its matching Protota preset', async ({ browser, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(async (id) => {
      const response = await fetch(`./presets/${id}.mockup.json`);
      const preset = await response.json();
      localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
    }, presetId);
    await page.reload();
    await expect(page.locator('adw-window')).toBeVisible();
    const prototaPng = await page.screenshot();
    await testInfo.attach(`protota-${appId}.png`, { body: prototaPng, contentType: 'image/png' });

    const referencePage = await browser.newPage({ viewport });
    await referencePage.goto(broadwayUrl!);
    await referencePage.waitForTimeout(2_000);
    const broadwayPng = await referencePage.screenshot();
    await testInfo.attach(`broadway-${appId}.png`, { body: broadwayPng, contentType: 'image/png' });
    await referencePage.close();

    const actual = PNG.sync.read(prototaPng);
    const reference = PNG.sync.read(broadwayPng);
    expect([actual.width, actual.height], 'Protota and Broadway must use the catalogued viewport').toEqual([reference.width, reference.height]);

    const diff = new PNG({ width: actual.width, height: actual.height });
    const differentPixels = pixelmatch(
      reference.data,
      actual.data,
      diff.data,
      actual.width,
      actual.height,
      { threshold: 0.1 },
    );
    const totalPixels = actual.width * actual.height;
    const differenceRatio = differentPixels / totalPixels;
    await testInfo.attach(`diff-${appId}.png`, { body: PNG.sync.write(diff), contentType: 'image/png' });
    await testInfo.attach(`comparison-${appId}.json`, {
      body: Buffer.from(JSON.stringify({ appId, differentPixels, totalPixels, differenceRatio }, null, 2)),
      contentType: 'application/json',
    });

    // Baseline collection is report-only. Once a preset is tuned, CI can set
    // a per-run maximum to make its visual delta an enforced contract.
    const maximumDifferenceRatio = process.env.BROADWAY_MAX_DIFF_RATIO;
    if (maximumDifferenceRatio) {
      expect(differenceRatio, `Visual difference ratio for ${appId}`).toBeLessThanOrEqual(Number(maximumDifferenceRatio));
    }
  });
});
