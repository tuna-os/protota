import { test, expect, type Page } from '@playwright/test';

/**
 * Live Blueprint syntax tier (BLP-L001, ADR 0001 Part 3 item 2).
 *
 * These tests run the REAL Pyodide runtime and vendored blueprint-compiler:
 * the assets are self-hosted by the dev server (no network beyond
 * localhost), so the opt-in flow, the loading state, and a genuine
 * parser-produced diagnostic are all exercised end to end. First load of
 * the ~14 MB runtime makes this spec slower than the rest — timeouts are
 * sized accordingly.
 */

declare global {
  interface Window {
    __mockupStore: {
      getState: () => {
        doc: { screens: Array<{ id: string; rootNode: unknown }> };
        updateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
        liveBlueprintStatus: string;
      };
    };
  }
}

/** Turn the first box into an unresolvable custom-widget whose source class
 * cannot tokenize as a Blueprint `$Type` reference — the way a mangled
 * imported class name would genuinely break the exported .blp. */
async function seedSyntaxBreakage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = window.__mockupStore.getState();
    type Node = { id: string; type: string; children?: Node[] };
    const findBox = (node: Node): Node | null => {
      if (node.type === 'box') return node;
      for (const child of node.children ?? []) {
        const found = findBox(child);
        if (found) return found;
      }
      return null;
    };
    const box = findBox(state.doc.screens[0].rootNode as Node);
    if (!box) throw new Error('no box node in default document');
    state.updateNodeProps(box.id, { type: 'custom-widget', sourceClass: 'Not A Class' });
    return box.id;
  });
}

test.describe('Live Blueprint syntax tier (BLP-L001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
    // Diagnostics are on by default (#161); open the panel's tab directly.
    await page.getByTestId('right-tab-diagnostics').click();
    await expect(page.getByTestId('diagnostics-panel')).toBeVisible();
  });

  test('is opt-in: no Pyodide request happens before the toggle', async ({ page }) => {
    let pyodideRequested = false;
    page.on('request', (request) => {
      if (request.url().includes('/pyodide/')) pyodideRequested = true;
    });
    // The panel is open with diagnostics on; give any eager load a chance.
    await page.waitForTimeout(500);
    expect(pyodideRequested).toBe(false);
    await expect(page.getByTestId('live-blueprint-status')).toHaveAttribute('data-status', 'off');
    await expect(page.getByTestId('live-blueprint-status')).toContainText('14 MB');
  });

  test('opt-in shows the loading state, then ready, and a clean doc stays clean', async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByTestId('live-blueprint-toggle').click();
    const status = page.getByTestId('live-blueprint-status');
    await expect(status).toHaveAttribute('data-status', 'loading');
    await expect(status).toContainText('Loading Python runtime');
    await expect(status).toHaveAttribute('data-status', 'ready', { timeout: 120_000 });
    // Honest labeling: this is a browser-side syntax check, not a compile.
    await expect(status).toContainText('Syntax check (browser)');
    await expect(status).toContainText('GIR validation runs on the host');
    // The default template exports valid Blueprint: no BLP-L001 cards.
    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="BLP-L001"]')).toHaveCount(0);
  });

  test('a real parser error surfaces as a BLP-L001 card anchored to the node', async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByTestId('live-blueprint-toggle').click();
    await expect(page.getByTestId('live-blueprint-status'))
      .toHaveAttribute('data-status', 'ready', { timeout: 120_000 });

    const nodeId = await seedSyntaxBreakage(page);
    const card = page.locator('[data-testid="diagnostic-card"][data-rule-id="BLP-L001"]').first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute('data-tier', 'error');
    await expect(card).toContainText('Syntax check (browser):');

    // The card anchors back onto the offending node.
    await card.click();
    const selected = await page.evaluate(() => window.__mockupStore.getState() as unknown as { selectedNodeId: string | null });
    expect((selected as { selectedNodeId: string | null }).selectedNodeId).toBe(nodeId);

    // The topbar badge counts it like any other error-tier diagnostic.
    await expect(page.getByTestId('diagnostics-badge')).toBeVisible();

    // Fixing the document clears the live diagnostic again.
    await page.evaluate((id) => {
      window.__mockupStore.getState().updateNodeProps(id, { type: 'box', sourceClass: undefined });
    }, nodeId);
    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="BLP-L001"]')).toHaveCount(0, { timeout: 30_000 });
  });

  test('toggling off clears live results and keeps the panel usable', async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByTestId('live-blueprint-toggle').click();
    await expect(page.getByTestId('live-blueprint-status'))
      .toHaveAttribute('data-status', 'ready', { timeout: 120_000 });
    await seedSyntaxBreakage(page);
    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="BLP-L001"]').first())
      .toBeVisible({ timeout: 30_000 });

    await page.getByTestId('live-blueprint-toggle').click();
    await expect(page.getByTestId('live-blueprint-status')).toHaveAttribute('data-status', 'off');
    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="BLP-L001"]')).toHaveCount(0);

    // Re-enabling reuses the warm worker: ready again without a fresh download.
    await page.getByTestId('live-blueprint-toggle').click();
    await expect(page.getByTestId('live-blueprint-status'))
      .toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  });
});
