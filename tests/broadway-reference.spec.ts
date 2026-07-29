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

type Rgba = { r: number; g: number; b: number; a: number };

function cornerBackground(image: PNG): Rgba {
  const offset = (image.height - 1) * image.width * 4 + (image.width - 1) * 4;
  return { r: image.data[offset], g: image.data[offset + 1], b: image.data[offset + 2], a: image.data[offset + 3] };
}

function isForeground(image: PNG, offset: number, background: Rgba): boolean {
  // Screenshots have opaque pixels, so alpha is not useful. A tolerance around
  // the lower-right window background isolates controls, text, separators and
  // content without rewarding two otherwise-empty windows for matching.
  return Math.max(
    Math.abs(image.data[offset] - background.r),
    Math.abs(image.data[offset + 1] - background.g),
    Math.abs(image.data[offset + 2] - background.b),
  ) > 12;
}

function foregroundOverlap(reference: PNG, actual: PNG) {
  const referenceBackground = cornerBackground(reference);
  const actualBackground = cornerBackground(actual);
  let referencePixels = 0;
  let actualPixels = 0;
  let intersection = 0;
  for (let offset = 0; offset < reference.data.length; offset += 4) {
    const referenceForeground = isForeground(reference, offset, referenceBackground);
    const actualForeground = isForeground(actual, offset, actualBackground);
    if (referenceForeground) referencePixels++;
    if (actualForeground) actualPixels++;
    if (referenceForeground && actualForeground) intersection++;
  }
  const union = referencePixels + actualPixels - intersection;
  return {
    referenceForegroundPixels: referencePixels,
    prototaForegroundPixels: actualPixels,
    foregroundIoU: union === 0 ? 1 : intersection / union,
  };
}

function unresolvedWidgetMask(width: number, height: number, rectangles: Array<{ x: number; y: number; width: number; height: number }>) {
  const mask = new Uint8Array(width * height);
  for (const rectangle of rectangles) {
    const startX = Math.max(0, Math.floor(rectangle.x));
    const startY = Math.max(0, Math.floor(rectangle.y));
    const endX = Math.min(width, Math.ceil(rectangle.x + rectangle.width));
    const endY = Math.min(height, Math.ceil(rectangle.y + rectangle.height));
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

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
    // This marker defines the same export boundary as the PNG exporter, rather
    // than relying on a positional crop within the editor.
    const prototaSurface = page.locator('[data-protota-render-surface="true"]');
    await expect(prototaSurface).toBeVisible();
    const unresolvedWidgets = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>('[data-protota-render-surface="true"]');
      if (!surface) return [];
      const surfaceRect = surface.getBoundingClientRect();
      return Array.from(surface.querySelectorAll<HTMLElement>('[data-protota-type="custom-widget"]')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x - surfaceRect.x, y: rect.y - surfaceRect.y, width: rect.width, height: rect.height };
      });
    });
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
    const foreground = foregroundOverlap(reference, actual);
    const unresolvedMask = unresolvedWidgetMask(actual.width, actual.height, unresolvedWidgets);
    const unresolvedWidgetPixels = unresolvedMask.reduce((sum, pixel) => sum + pixel, 0);
    const resolvedPixels = totalPixels - unresolvedWidgetPixels;
    const maskedActual = PNG.sync.read(prototaPng);
    for (let index = 0; index < unresolvedMask.length; index++) {
      if (!unresolvedMask[index]) continue;
      const offset = index * 4;
      maskedActual.data[offset] = reference.data[offset];
      maskedActual.data[offset + 1] = reference.data[offset + 1];
      maskedActual.data[offset + 2] = reference.data[offset + 2];
      maskedActual.data[offset + 3] = reference.data[offset + 3];
    }
    const resolvedDifferentPixels = pixelmatch(
      reference.data,
      maskedActual.data,
      new PNG({ width: actual.width, height: actual.height }).data,
      actual.width,
      actual.height,
      { threshold: 0.1 },
    );
    const unresolvedWidgetCoverage = unresolvedWidgetPixels / totalPixels;
    // A custom-widget boundary is deliberately not a claimed native render.
    // Its coverage is the maximum fraction of the raw surface that remains
    // outside the source-derived renderer's evidence.
    const rawSimilarityCeiling = 1 - unresolvedWidgetCoverage;
    const sourceResolvedSimilarity = resolvedPixels === 0 ? 0 : 1 - resolvedDifferentPixels / resolvedPixels;
    await attachArtifact(`diff-${appId}.png`, PNG.sync.write(diff), 'image/png');
    await attachArtifact(
      `comparison-${appId}.json`,
      Buffer.from(JSON.stringify({
        appId, differentPixels, totalPixels, differenceRatio, ...foreground,
        unresolvedWidgetPixels, unresolvedWidgetCoverage, rawSimilarityCeiling,
        resolvedDifferentPixels, resolvedPixels, sourceResolvedSimilarity,
      }, null, 2)),
      'application/json',
    );

    // Baseline collection is report-only. Once a preset is tuned, CI can set
    // a per-run maximum to make its visual delta an enforced contract.
    const maximumDifferenceRatio = process.env.BROADWAY_MAX_DIFF_RATIO;
    if (maximumDifferenceRatio) {
      expect(differenceRatio, `Visual difference ratio for ${appId}`).toBeLessThanOrEqual(Number(maximumDifferenceRatio));
    }
    const minimumSourceResolvedSimilarity = process.env.BROADWAY_MIN_SOURCE_RESOLVED_SIMILARITY;
    if (minimumSourceResolvedSimilarity) {
      expect(sourceResolvedSimilarity, `Source-resolved visual similarity for ${appId}`).toBeGreaterThanOrEqual(Number(minimumSourceResolvedSimilarity));
    }
    const maximumUnresolvedWidgetCoverage = process.env.BROADWAY_MAX_UNRESOLVED_WIDGET_COVERAGE;
    if (maximumUnresolvedWidgetCoverage) {
      expect(unresolvedWidgetCoverage, `Unresolved custom-widget coverage for ${appId}`).toBeLessThanOrEqual(Number(maximumUnresolvedWidgetCoverage));
    }
  });
});
