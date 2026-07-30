import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { blueprintBundleToDocument } from '../src/utils/blueprint';

const broadwayUrl = process.env.BROADWAY_URL;
const presetId = process.env.BROADWAY_PRESET_ID || 'calculator';
const appId = process.env.BROADWAY_APP_ID || presetId;
const sourceRoot = process.env.BROADWAY_SOURCE_ROOT;
const sourceEntry = process.env.BROADWAY_SOURCE_ENTRY;
// Which screen of a multi-screen preset depicts the captured native window.
const screenId = process.env.BROADWAY_SCREEN_ID;
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

function sourceBundleDocument() {
  if (!sourceRoot || !sourceEntry) return null;
  // Recursive: declarative UI files plus language sources for static
  // enrichment (Phase 4), wherever the app keeps them under the source root.
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(blp|ui|vala)$/i.test(entry.name))
    .map(entry => {
      const absolute = join(entry.parentPath, entry.name);
      return { path: relative(sourceRoot, absolute), content: readFileSync(absolute, 'utf8') };
    });
  return blueprintBundleToDocument(files, sourceEntry, `GNOME ${appId}`);
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
    const sourceDocument = sourceBundleDocument();
    await page.goto('/');
    await page.evaluate(async ({ id, width, height, document, screenId }) => {
      const preset = document ? { document } : await fetch(`./presets/${id}.mockup.json`).then(response => response.json());
      // A preset may hold several screens (mode variants, dialogs); compare
      // exactly one against the native window it depicts.
      const chosen = preset.document.screens.find((screen: { id: string }) => screen.id === screenId)
        ?? preset.document.screens[0];
      preset.document.screens = [chosen];
      preset.document.edges = [];
      // Render the editable document at the native app surface dimensions.
      // This is a renderer contract, not an app-specific layout adjustment.
      chosen.width = width;
      chosen.height = height;
      // The editor persists an edited document as Blueprint source under its
      // own key, which takes precedence over this injected JSON document.
      // Clear it so the comparison always renders this run's import.
      localStorage.clear();
      localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
      // App-shipped artwork embedded by the preset generator.
      if (preset.sourceIcons) localStorage.setItem('protota_source_icons_v1', JSON.stringify(preset.sourceIcons));
    }, { id: presetId, width: reference.width, height: reference.height, document: sourceDocument, screenId });
    await page.reload();
    // The comparison target is the application render surface.  Explicitly
    // switch off editor-only chrome that may otherwise be positioned above it.
    await page.evaluate(() => {
      document.documentElement.dataset.prototaCapture = 'true';
    });
    // This marker defines the same export boundary as the PNG exporter, rather
    // than relying on a positional crop within the editor.
    const prototaSurface = page.locator('[data-protota-render-surface="true"]');
    await expect(prototaSurface).toBeVisible();
    const prototaBounds = await prototaSurface.boundingBox();
    expect(prototaBounds, 'Protota must expose a measurable render surface').not.toBeNull();
    expect(Math.round(prototaBounds!.width), 'Protota surface width must equal the native window').toBe(reference.width);
    expect(Math.round(prototaBounds!.height), 'Protota surface height must equal the native window').toBe(reference.height);
    await attachArtifact(
      `geometry-${appId}.json`,
      Buffer.from(JSON.stringify({
        appId,
        nativeWindow: nativeBounds,
        prototaSurface: prototaBounds,
        // Both screenshots are clipped to their surface; page coordinates are
        // diagnostic only and cannot contaminate the visual comparison.
        comparisonSize: { width: reference.width, height: reference.height },
      }, null, 2)),
      'application/json',
    );
    const unresolvedWidgets = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>('[data-protota-render-surface="true"]');
      if (!surface) return [];
      const surfaceRect = surface.getBoundingClientRect();
      // An expanded composite renders projected source contents; only
      // childless boundaries remain unresolved coverage.
      return Array.from(surface.querySelectorAll<HTMLElement>('[data-protota-type="custom-widget"]:not([data-protota-expanded])')).map((element) => {
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
        appId, inputKind: sourceDocument ? 'source-bundle' : 'legacy-preset',
        differentPixels, totalPixels, differenceRatio, ...foreground,
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
