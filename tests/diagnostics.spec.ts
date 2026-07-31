import { test, expect, type Page } from '@playwright/test';

/**
 * Diagnostics mechanism (#95): toggle opens the right-drawer panel, a seeded
 * violation appears with its tier, clicking selects the node, ignoring hides
 * it, and the topbar badge count tracks it all.
 */

declare global {
  interface Window {
    __mockupStore: {
      getState: () => {
        doc: { screens: Array<{ id: string; rootNode: unknown }> };
        selectedNodeId: string | null;
        diagnostics: Array<{ ruleId: string; nodeId: string }>;
        updateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
      };
    };
  }
}

/** Set the first box node's spacing off-scale, seeding one HIG-W001 warning. */
async function seedSpacingViolation(page: Page): Promise<string> {
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
    state.updateNodeProps(box.id, { spacing: 13 });
    return box.id;
  });
}

test.describe('Diagnostics (#95)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('toggle opens the diagnostics panel in the right drawer', async ({ page }) => {
    const toggle = page.getByTestId('diagnostics-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('diagnostics-panel')).toBeVisible();
    // The drawer lands on the Diagnostics tab, not Properties.
    await expect(page.getByTestId('right-tab-diagnostics')).toHaveAttribute('aria-selected', 'true');
    // The default template is clean, so the empty state shows.
    await expect(page.getByTestId('diagnostics-empty')).toBeVisible();
  });

  test('a seeded violation appears as a card with its tier and rule id', async ({ page }) => {
    await seedSpacingViolation(page);
    await page.getByTestId('diagnostics-toggle').click();

    const card = page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-tier', 'warning');
    await expect(card).toContainText('Spacing 13px not on HIG scale');
    // Tier chips carry live counts.
    await expect(page.getByTestId('diag-filter-warning')).toContainText('Warnings (1)');
    await expect(page.getByTestId('diag-filter-error')).toContainText('Errors (0)');
  });

  test('clicking a card selects the offending node on the canvas', async ({ page }) => {
    const boxId = await seedSpacingViolation(page);
    await page.getByTestId('diagnostics-toggle').click();

    await page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]').click();
    await expect(page.locator('.selected-outline').first()).toBeVisible();
    const selected = await page.evaluate(() => window.__mockupStore.getState().selectedNodeId);
    expect(selected).toBe(boxId);
  });

  test('badge counts issues and updates when one is ignored', async ({ page }) => {
    await seedSpacingViolation(page);
    await page.getByTestId('diagnostics-toggle').click();

    const badge = page.getByTestId('diagnostics-badge');
    await expect(badge).toHaveText('1');

    // Expand the card and dismiss this instance.
    await page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]').click();
    await page.getByTestId('diagnostic-ignore').click();
    await page.getByTestId('ignore-instance').click();

    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]')).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    await expect(page.getByTestId('diagnostics-empty')).toBeVisible();
  });

  test('tier filter chips hide and restore cards without re-running the engine', async ({ page }) => {
    await seedSpacingViolation(page);
    await page.getByTestId('diagnostics-toggle').click();

    const card = page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]');
    await expect(card).toBeVisible();
    await page.getByTestId('diag-filter-warning').click();
    await expect(card).toHaveCount(0);
    await page.getByTestId('diag-filter-warning').click();
    await expect(card).toBeVisible();
  });

  test('quick fix repairs the document and clears the card', async ({ page }) => {
    const boxId = await seedSpacingViolation(page);
    await page.getByTestId('diagnostics-toggle').click();

    await page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]').click();
    await page.getByTestId('diagnostic-fix').click();

    await expect(page.locator('[data-testid="diagnostic-card"][data-rule-id="HIG-W001"]')).toHaveCount(0);
    const spacing = await page.evaluate((id) => {
      type Node = { id: string; spacing?: number; children?: Node[] };
      const find = (node: Node): Node | null => {
        if (node.id === id) return node;
        for (const child of node.children ?? []) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      };
      return find(window.__mockupStore.getState().doc.screens[0].rootNode as Node)?.spacing;
    }, boxId);
    expect(spacing).toBe(12);
  });

  test('canvas outlines mark diagnosed nodes and clear with the toggle', async ({ page }) => {
    await seedSpacingViolation(page);
    const toggle = page.getByTestId('diagnostics-toggle');
    await toggle.click();
    await expect(page.locator('.protota-diag-outline-warning')).toHaveCount(1);
    await toggle.click();
    await expect(page.locator('.protota-diag-outline-warning')).toHaveCount(0);
  });
});
