import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
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
    const attachArtifact = async (name: string, body: Buffer, contentType: string) => {
      const path = testInfo.outputPath(name);
      writeFileSync(path, body);
      await testInfo.attach(name, { path, contentType });
    };

    // Broadway's generated DOM has no GTK widget semantics, but its first
    // translated child is the native app surface. Capture that surface rather
    // than the browser page (which includes Broadway's outer canvas margin).
    const referencePage = await browser.newPage({ viewport: { width: Math.max(viewport.width, 1280), height: Math.max(viewport.height, 900) } });
    await referencePage.goto(broadwayUrl!);
    await referencePage.waitForTimeout(2_000);
    const nativeBounds = await referencePage.locator('div').evaluateAll((elements) => {
      const viewportArea = window.innerWidth * window.innerHeight;
      const candidates = elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, area: rect.width * rect.height };
        })
        // Broadway adds an outer canvas at (0,0); the native window is the
        // largest painted descendant inset within that canvas.
        .filter(rect => rect.x > 0 && rect.y > 0 && rect.width > 100 && rect.height > 100 && rect.area < viewportArea);
      return candidates.sort((a, b) => b.area - a.area)[0] || null;
    });
    expect(nativeBounds, 'Broadway must expose a painted native window surface').not.toBeNull();
    const broadwayPng = await referencePage.screenshot({ clip: nativeBounds! });
    await attachArtifact(`broadway-${appId}.png`, broadwayPng, 'image/png');
    await referencePage.close();

    const reference = PNG.sync.read(broadwayPng);
    await page.goto('/');
    await page.evaluate(async ({ id, width, height }) => {
      const response = await fetch(`./presets/${id}.mockup.json`);
      const preset = await response.json();
      // Render the editable document at the native app surface dimensions.
      // This is a renderer contract, not an app-specific layout adjustment.
      preset.document.screens[0].width = width;
      preset.document.screens[0].height = height;
      localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
    }, { id: presetId, width: reference.width, height: reference.height });
    await page.reload();
    const prototaSurface = page.locator('adw-window');
    await expect(prototaSurface).toBeVisible();
    const prototaPng = await prototaSurface.screenshot();
    await attachArtifact(`protota-${appId}.png`, prototaPng, 'image/png');

    const actual = PNG.sync.read(prototaPng);
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
    await attachArtifact(`diff-${appId}.png`, PNG.sync.write(diff), 'image/png');
    await attachArtifact(
      `comparison-${appId}.json`,
      Buffer.from(JSON.stringify({ appId, differentPixels, totalPixels, differenceRatio }, null, 2)),
      'application/json',
    );

    // Baseline collection is report-only. Once a preset is tuned, CI can set
    // a per-run maximum to make its visual delta an enforced contract.
    const maximumDifferenceRatio = process.env.BROADWAY_MAX_DIFF_RATIO;
    if (maximumDifferenceRatio) {
      expect(differenceRatio, `Visual difference ratio for ${appId}`).toBeLessThanOrEqual(Number(maximumDifferenceRatio));
    }
  });
});
