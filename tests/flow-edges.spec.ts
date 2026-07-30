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
