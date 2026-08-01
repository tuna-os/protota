/**
 * Measure an app preset's unresolved custom-widget coverage without a native
 * capture: render the shipped preset at the catalogued viewport and compute
 * the same childless-boundary mask fraction the Broadway comparison reports.
 *
 *   npx tsx scripts/measure-unresolved-coverage.mjs <appId> [--screen id] [--out dir]
 *
 * Purpose (#59 gates): apps whose pinned source version has no version-matched
 * packaged runner (Circle apps missing from Fedora/Ubuntu, Disks pinned ahead
 * of every distro) still get a `maxUnresolvedCoverage` gate; this artifact is
 * the measured number that gate traces to. It needs the dev server running
 * (`npm run dev`), exactly like scripts/capture-preset.mjs.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const appId = args.find((argument) => !argument.startsWith('--'));
const screenId = args.includes('--screen') ? args[args.indexOf('--screen') + 1] : undefined;
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(repoRoot, 'artifacts');

if (!appId) {
  console.error('Usage: npx tsx scripts/measure-unresolved-coverage.mjs <appId> [--screen id] [--out dir]');
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(join(repoRoot, 'tests/fixtures/gnome-app-catalog.json'), 'utf8'));
const app = catalog[appId];
if (!app) throw new Error(`Unknown app "${appId}"`);
const preset = JSON.parse(readFileSync(join(repoRoot, `public/presets/${appId}.mockup.json`), 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: app.viewport.width + 200, height: app.viewport.height + 200 } });
await page.goto('http://localhost:5173/');
await page.evaluate(({ preset, screenId, viewport }) => {
  const chosen = preset.document.screens.find((screen) => screen.id === screenId) ?? preset.document.screens[0];
  preset.document.screens = [chosen];
  preset.document.edges = [];
  // The comparison contract: render the screen at the catalogued native size.
  chosen.width = viewport.width;
  chosen.height = viewport.height;
  localStorage.clear();
  localStorage.setItem('protota_doc_v1', JSON.stringify(preset.document));
  if (preset.sourceIcons) localStorage.setItem('protota_source_icons_v1', JSON.stringify(preset.sourceIcons));
}, { preset, screenId, viewport: app.viewport });
await page.reload();
await page.evaluate(() => { document.documentElement.dataset.prototaCapture = 'true'; });
await page.waitForSelector('[data-protota-render-surface="true"]', { timeout: 10000 });
await page.waitForTimeout(500);

const result = await page.evaluate(() => {
  const surface = document.querySelector('[data-protota-render-surface="true"]');
  const surfaceRect = surface.getBoundingClientRect();
  const width = Math.round(surfaceRect.width);
  const height = Math.round(surfaceRect.height);
  // Same rule as tests/broadway-reference.spec.ts: an expanded composite
  // renders projected source contents; only childless boundaries remain
  // unresolved coverage. Same rasterised mask, so overlaps are not
  // double-counted.
  const rectangles = Array.from(
    surface.querySelectorAll('[data-protota-type="custom-widget"]:not([data-protota-expanded])'),
  ).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x - surfaceRect.x, y: rect.y - surfaceRect.y, width: rect.width, height: rect.height,
      nodeId: element.dataset.nodeId ?? null,
      sourceClass: element.dataset.prototaSourceClass ?? null,
    };
  });
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
  let unresolvedPixels = 0;
  for (const pixel of mask) unresolvedPixels += pixel;
  return {
    surface: { width, height },
    totalPixels: width * height,
    unresolvedWidgetPixels: unresolvedPixels,
    unresolvedWidgetCoverage: unresolvedPixels / (width * height),
    unresolvedWidgets: rectangles,
  };
});

const artifact = {
  appId,
  measuredAt: new Date().toISOString(),
  method: 'scripts/measure-unresolved-coverage.mjs (shipped preset at catalogued viewport, no native reference)',
  viewport: app.viewport,
  screenId: screenId ?? preset.document.screens[0]?.id,
  ...result,
};
const outputPath = join(outDir, `unresolved-coverage-${appId}.json`);
writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n');
console.log(outputPath);
console.log(`${appId}: unresolvedWidgetCoverage=${(result.unresolvedWidgetCoverage * 100).toFixed(2)}% over ${result.unresolvedWidgets.length} boundary rect(s)`);
await browser.close();
