/**
 * Write-back UX bridge (ADR 0001 Part 3 item 1): "Export → Patch into
 * Checkout…" — download + generated protota-writeback command on every
 * browser, plus the File System Access direct path on Chromium.
 *
 * The FS Access flow is mocked at the `window.showDirectoryPicker` boundary
 * (an in-memory directory handle over the same fixture checkout): Playwright
 * cannot grant a real directory handle headlessly — the picker requires a
 * user gesture and offers no automation hook — so the real read/write handle
 * plumbing is covered by unit tests (writeback-core.test.ts) against the
 * identical structural interface, and this spec covers everything from the
 * dialog through discovery, plan, report, confirm, and the write calls.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const checkoutDir = join(here, 'fixtures', 'writeback-checkout');

const fixtureFiles: Record<string, string> = {
  'src/window.blp': readFileSync(join(checkoutDir, 'src', 'window.blp'), 'utf8'),
  'src/panel.blp': readFileSync(join(checkoutDir, 'src', 'panel.blp'), 'utf8'),
  'src/meson.build': readFileSync(join(checkoutDir, 'src', 'meson.build'), 'utf8'),
};

const openWritebackDialog = async (page: Page) => {
  await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: /Patch into Checkout/ }).click();
  await expect(page.getByTestId('writeback-dialog')).toBeVisible();
};

/**
 * Install an in-memory `window.showDirectoryPicker` over a flat
 * `{ path → text }` map. Writes are recorded on `window.__writebackWrites`.
 */
const mockDirectoryPicker = (page: Page, files: Record<string, string>) =>
  page.addInitScript((fileMap: Record<string, string>) => {
    type Tree = { [name: string]: Tree | string };
    const tree: Tree = {};
    for (const [path, content] of Object.entries(fileMap)) {
      const segments = path.split('/');
      let node = tree;
      for (const segment of segments.slice(0, -1)) {
        node = (node[segment] ??= {}) as Tree;
      }
      node[segments[segments.length - 1]] = content;
    }
    const writes: Record<string, string> = {};
    (window as unknown as { __writebackWrites: Record<string, string> }).__writebackWrites = writes;
    const fileHandle = (name: string, parent: Tree, path: string) => ({
      kind: 'file',
      name,
      getFile: async () => new File([parent[name] as string], name),
      createWritable: async () => {
        let buffer = '';
        return {
          write: async (data: string) => { buffer += data; },
          close: async () => { parent[name] = buffer; writes[path] = buffer; },
        };
      },
    });
    const directoryHandle = (name: string, node: Tree, path: string) => ({
      kind: 'directory',
      name,
      entries: async function* () {
        for (const [entryName, value] of Object.entries(node)) {
          const entryPath = path ? `${path}/${entryName}` : entryName;
          yield [
            entryName,
            typeof value === 'string'
              ? fileHandle(entryName, node, entryPath)
              : directoryHandle(entryName, value, entryPath),
          ];
        }
      },
      getDirectoryHandle: async (childName: string) => {
        const value = node[childName];
        if (typeof value !== 'object' || value === null) throw new DOMException(childName, 'NotFoundError');
        return directoryHandle(childName, value, path ? `${path}/${childName}` : childName);
      },
      getFileHandle: async (childName: string) => {
        if (typeof node[childName] !== 'string') throw new DOMException(childName, 'NotFoundError');
        return fileHandle(childName, node, path ? `${path}/${childName}` : childName);
      },
    });
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker =
      async () => directoryHandle('checkout', tree, '');
  }, files);

test.describe('Export → Patch into Checkout (write-back UX bridge)', () => {
  test('dialog: privacy statement, generated command with typed path, dry-run note, download', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await openWritebackDialog(page);

    await expect(page.getByTestId('writeback-privacy')).toHaveText(/nothing leaves this machine/);
    await expect(page.getByTestId('writeback-dryrun-note')).toContainText('dry run by default');

    // Command regenerates from the typed checkout path and the real doc title.
    await page.getByTestId('writeback-checkout-path').fill('~/src/gnome-calculator');
    await expect(page.getByTestId('writeback-command')).toHaveText(
      'npx tsx scripts/protota-writeback.mjs --checkout ~/src/gnome-calculator --document untitled-gnome-app.mockup.json',
    );
    // A path with spaces is shell-quoted.
    await page.getByTestId('writeback-checkout-path').fill('/home/me/My Apps/calc');
    await expect(page.getByTestId('writeback-command')).toContainText('--checkout "/home/me/My Apps/calc"');

    // The --bpc container variant is one click away.
    await expect(page.getByTestId('writeback-copy-bpc')).toBeVisible();

    // Download really triggers with the .mockup.json name.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByTestId('writeback-download').click(),
    ]);
    expect(download.suggestedFilename()).toBe('untitled-gnome-app.mockup.json');
  });

  test('copy button puts the generated command on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await openWritebackDialog(page);
    await page.getByTestId('writeback-checkout-path').fill('~/src/demo');
    await page.getByTestId('writeback-copy').click();
    await expect(page.getByTestId('writeback-copy')).toHaveText('Copied!');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('npx tsx scripts/protota-writeback.mjs --checkout ~/src/demo --document untitled-gnome-app.mockup.json');
  });

  test('degrades without the File System Access API: only download + command path', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    });
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await openWritebackDialog(page);
    await expect(page.getByTestId('writeback-command')).toBeVisible();
    await expect(page.getByTestId('writeback-direct')).toHaveCount(0);
  });

  test('FS Access path (mocked picker): report every touched file, confirm gate, write through the handle', async ({ page }) => {
    await mockDirectoryPicker(page, fixtureFiles);
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    // Bring the fixture checkout into the editor through the import front door.
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByRole('menuitem', { name: /Import App/ }).click();
    await page.getByTestId('import-app-folder-input').setInputFiles(checkoutDir);
    await expect(page.getByTestId('import-app-entry')).toHaveValue('src/window.blp');
    await page.getByTestId('import-app-confirm').click();
    await page.waitForSelector('adw-window', { timeout: 10000 });

    // Make one edit, deterministically, through the persisted document source.
    await page.evaluate(() => {
      const key = 'protota_blueprint_v1';
      const source = localStorage.getItem(key);
      if (!source || !source.includes('label: "Open";')) throw new Error('persisted source missing the fixture label');
      localStorage.setItem(key, source.replace('label: "Open";', 'label: "Open File";'));
    });
    await page.reload();
    await page.waitForSelector('adw-window', { timeout: 10000 });

    await openWritebackDialog(page);
    await page.getByTestId('writeback-direct').click();

    // The #80 rule: every touched file is reported, with per-edit labels,
    // before anything can be written.
    const report = page.getByTestId('writeback-report');
    await expect(report).toBeVisible();
    await expect(page.getByTestId('writeback-touched-file')).toHaveCount(1);
    await expect(page.getByTestId('writeback-touched-file')).toContainText('src/panel.blp');
    await expect(page.getByTestId('writeback-touched-file')).toContainText('label: "Open File"');
    // In-browser limitation stated plainly, host validation command provided.
    await expect(page.getByTestId('writeback-validate-note')).toContainText('cannot run in the browser');
    await expect(report).toContainText('blueprint-compiler compile src/panel.blp');
    // Nothing written yet — the confirm is the --write gate.
    expect(await page.evaluate(() =>
      (window as unknown as { __writebackWrites: Record<string, string> }).__writebackWrites,
    )).toEqual({});

    await page.getByTestId('writeback-confirm').click();
    await expect(page.getByTestId('writeback-success')).toContainText('src/panel.blp');

    const writes = await page.evaluate(() =>
      (window as unknown as { __writebackWrites: Record<string, string> }).__writebackWrites,
    );
    expect(Object.keys(writes)).toEqual(['src/panel.blp']);
    // Minimal patch: translation wrapper preserved, comment intact.
    expect(writes['src/panel.blp']).toContain('_("Open File")');
    expect(writes['src/panel.blp']).toContain('// The action strip shown under the content.');
    expect(writes['src/panel.blp']).toContain('label: "Close";');
  });

  test('FS Access path reports "nothing to do" for an unedited import', async ({ page }) => {
    await mockDirectoryPicker(page, fixtureFiles);
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByRole('menuitem', { name: /Import App/ }).click();
    await page.getByTestId('import-app-folder-input').setInputFiles(checkoutDir);
    await page.getByTestId('import-app-confirm').click();
    await page.waitForSelector('adw-window', { timeout: 10000 });

    await openWritebackDialog(page);
    await page.getByTestId('writeback-direct').click();
    await expect(page.getByTestId('writeback-no-changes')).toContainText('Nothing to do');
    await expect(page.getByTestId('writeback-confirm')).toHaveCount(0);
  });

  test('ExportModal links to the write-back dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('menuitem', { name: /export code/i }).click();
    await page.getByTestId('export-writeback-open').click();
    await expect(page.getByTestId('writeback-dialog')).toBeVisible();
  });
});
