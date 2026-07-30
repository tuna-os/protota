import { test, expect } from '@playwright/test';

test.describe('Flow edges (#11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('Show Flows toggle exists in toolbar', async ({ page }) => {
    const flowsBtn = page.getByRole('button', { name: /flow/i });
    await expect(flowsBtn).toBeVisible();
  });

  test('toggling flows shows/hides arrow overlays', async ({ page }) => {
    const flowsBtn = page.getByRole('button', { name: /flow/i });
    await flowsBtn.click();
    // Flow mode should be active
    await expect(flowsBtn).toHaveAttribute('data-active', 'true');
    await flowsBtn.click();
    await expect(flowsBtn).not.toHaveAttribute('data-active', 'true');
  });

  test('user can author a flow edge from the inspector', async ({ page }) => {
    // Add a second screen to connect to.
    await page.getByRole('button', { name: /add screen/i }).click();
    const dialog = page.locator('.protota-modal');
    await dialog.locator('input[type="text"]').fill('Details');
    await dialog.getByRole('button', { name: /create screen/i }).click();

    // Select anything in the first screen; the inspector shows the flow editor.
    await page.locator('.protota-canvas adw-header-bar').first().click({ position: { x: 8, y: 8 } });
    const flowEditor = page.getByTestId('flow-editor');
    await expect(flowEditor).toBeVisible();

    await flowEditor.getByLabel('Add flow to screen').selectOption({ label: 'Details' });
    await expect(page.locator('.protota-flow-overlay path[marker-end]')).toHaveCount(1);

    // The edge is removable again from the same editor.
    await flowEditor.getByRole('button', { name: /remove flow to details/i }).click();
    await expect(page.locator('.protota-flow-overlay path[marker-end]')).toHaveCount(0);
  });

  test('edges slot is preserved in document model', async ({ page }) => {
    // Export the document
    const exportBtn = page.getByRole('button', { name: /save json/i });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const content = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(content);

    // edges array should exist (even if empty)
    expect(parsed.document.edges).toBeDefined();
    expect(Array.isArray(parsed.document.edges)).toBe(true);
  });
});
