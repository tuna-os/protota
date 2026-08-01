/**
 * Import App front door (#118): File menu → dialog → folder/zip ingest →
 * discovery manifest → entry selection → import replaces the document.
 * Git-URL fetching is unit-tested with fetch mocked (src/__tests__/
 * app-ingest.test.ts); no live network is touched here.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const checkoutDir = join(here, 'fixtures', 'import-app-checkout');

const openImportAppDialog = async (page: Page) => {
  await page.goto('/');
  await page.waitForSelector('adw-window', { timeout: 10000 });
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: /Import App/ }).click();
  await expect(page.getByTestId('import-app-dialog')).toBeVisible();
};

// Minimal stored-entry zip writer (the in-page reader ignores CRCs).
function buildZip(entries: { name: string; data: string }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    chunks.push(local, data);
    const dir = Buffer.alloc(46 + name.length);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    name.copy(dir, 46);
    central.push(dir);
    offset += local.length + data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuffer, eocd]);
}

test.describe('Import App front door (#118)', () => {
  test('File menu opens the dialog with the local-processing statement', async ({ page }) => {
    await openImportAppDialog(page);
    await expect(page.getByTestId('import-app-privacy')).toHaveText(
      /read locally in your browser — nothing is uploaded/,
    );
    await expect(page.getByTestId('import-app-dropzone')).toBeVisible();
    await expect(page.getByTestId('import-app-url')).toBeVisible();
  });

  test('folder ingest shows the discovery manifest and imports the app', async ({ page }) => {
    await openImportAppDialog(page);
    await page.getByTestId('import-app-folder-input').setInputFiles(checkoutDir);

    // Manifest: metadata-driven discovery, exclusion note, unresolved template.
    const manifest = page.getByTestId('import-app-manifest');
    await expect(manifest).toBeVisible();
    await expect(manifest).toContainText('build-metadata');
    await expect(manifest).toContainText('src/window.blp');
    await expect(manifest).toContainText('src/panel.blp');
    await expect(manifest).toContainText('src/scratch.blp'); // in the exclusion note
    await expect(page.getByTestId('import-app-file')).toHaveCount(2);
    await expect(page.getByTestId('import-app-unresolved')).toContainText('ThirdPartyWidget');

    // The single window-bearing candidate is pre-selected as the entry.
    await expect(page.getByTestId('import-app-entry')).toHaveValue('src/window.blp');

    await page.getByTestId('import-app-confirm').click();
    await page.waitForSelector('adw-window', { timeout: 10000 });
    // The imported app renders: template-expanded panel button from panel.blp.
    await expect(page.locator('adw-window').getByText('Open', { exact: true }).first())
      .toBeVisible({ timeout: 10000 });
  });

  test('zip ingest runs the same discovery flow in-page', async ({ page }) => {
    await openImportAppDialog(page);
    const zip = buildZip([
      {
        name: 'demo-main/src/window.blp',
        data: 'using Gtk 4.0;\nusing Adw 1;\nAdw.ApplicationWindow { title: "Zip Demo"; content: Adw.ToolbarView { Adw.HeaderBar {} content: Gtk.Label zipped_label { label: "Hello from the zip"; }; }; }\n',
      },
      { name: 'demo-main/src/meson.build', data: "files('window.blp')" },
    ]);
    await page.getByTestId('import-app-zip-input').setInputFiles({
      name: 'demo-main.zip',
      mimeType: 'application/zip',
      buffer: zip,
    });
    const manifest = page.getByTestId('import-app-manifest');
    await expect(manifest).toBeVisible();
    await expect(manifest).toContainText('src/window.blp');
    await expect(page.getByTestId('import-app-entry')).toHaveValue('src/window.blp');

    await page.getByTestId('import-app-confirm').click();
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await expect(page.locator('adw-window').getByText('Hello from the zip').first())
      .toBeVisible({ timeout: 10000 });
  });

  test('a bad archive fails with an explicit error, not a broken document', async ({ page }) => {
    await openImportAppDialog(page);
    await page.getByTestId('import-app-zip-input').setInputFiles({
      name: 'not-a-zip.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('this is not an archive at all'),
    });
    await expect(page.getByTestId('import-app-error')).toContainText(/archive|ZIP/i);
  });
});
