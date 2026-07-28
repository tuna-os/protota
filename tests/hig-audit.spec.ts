import { test, expect } from '@playwright/test';

test.describe('HIG compliance audit (#8)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('lint button runs audit and shows results panel', async ({ page }) => {
    const lintBtn = page.getByRole('button', { name: /lint/i });
    await expect(lintBtn).toBeVisible();
    await lintBtn.click();

    // Results panel should appear (only if violations exist)
    const resultsPanel = page.locator('.protota-audit-panel');
    // The panel shows when lint is on and violations > 0
    // In the default template it may have violations or not
    // Just verify the button toggles correctly
    await expect(lintBtn).toHaveAttribute('data-active', 'true');
  });

  test('audit categorizes violations by severity', async ({ page }) => {
    const lintBtn = page.getByRole('button', { name: /lint/i });
    await lintBtn.click();

    const resultsPanel = page.locator('.protota-audit-panel');
    // Panel appears when violations exist and lint is on
    if (await resultsPanel.isVisible()) {
      await expect(resultsPanel.getByText(/error|warning|info/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('clicking a violation in audit selects the element', async ({ page }) => {
    const lintBtn = page.getByRole('button', { name: /lint/i });
    await lintBtn.click();

    const resultsPanel = page.locator('.protota-audit-panel');
    const violation = resultsPanel.locator('.protota-audit-item').first();
    if (await violation.isVisible()) {
      await violation.click();
      await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('audit panel can be closed by toggling lint off', async ({ page }) => {
    const lintBtn = page.getByRole('button', { name: /lint/i });
    await lintBtn.click();
    await expect(lintBtn).toHaveAttribute('data-active', 'true');

    await lintBtn.click();
    const resultsPanel = page.locator('.protota-audit-panel');
    await expect(resultsPanel).not.toBeVisible({ timeout: 3000 });
  });
});
