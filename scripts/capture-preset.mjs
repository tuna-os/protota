/**
 * Render a preset in the real editor and screenshot it for visual review.
 *
 *   npx tsx scripts/capture-preset.mjs <appId> [--zoom-out N] [--out dir]
 *
 * Starts from public/presets/<appId>.mockup.json, loads it into the running
 * dev server (http://localhost:5173 — start with `npm run dev`), hides
 * editor chrome, and captures the whole canvas (all screens plus flow
 * arrows; flows are switched on for the capture). Use it after
 * import-gnome-app.mjs to eyeball a regenerated preset before committing.
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const appId = args.find((argument) => !argument.startsWith('--'));
const zoomOut = Number(args[args.indexOf('--zoom-out') + 1] || 6);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(repoRoot, 'artifacts');

if (!appId) {
  console.error('Usage: npx tsx scripts/capture-preset.mjs <appId> [--zoom-out N] [--out dir]');
  process.exit(1);
}

const preset = JSON.parse(readFileSync(join(repoRoot, `public/presets/${appId}.mockup.json`), 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
await page.goto('http://localhost:5173/');
await page.evaluate((doc) => {
  localStorage.clear();
  localStorage.setItem('protota_doc_v1', JSON.stringify(doc));
}, preset.document);
await page.reload();
await page.evaluate(() => {
  document.documentElement.dataset.prototaCapture = 'true';
  const store = window.__mockupStore;
  if (store && !store.getState().showFlows) store.getState().toggleShowFlows();
});
await page.waitForSelector('[data-protota-render-surface="true"]', { timeout: 30000 });
for (let index = 0; index < zoomOut; index++) {
  await page.evaluate(() => window.dispatchEvent(new Event('protota:zoom-out')));
}
await page.waitForTimeout(600);
const outputPath = join(outDir, `preset-${appId}.png`);
await page.locator('.protota-canvas').screenshot({ path: outputPath });
console.log(outputPath);
await browser.close();
