import { test, expect } from '@playwright/test';

test.describe('Export to PNG (#17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('export button exists in toolbar', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export/i });
    await expect(exportBtn).toBeVisible();
  });

  test('clicking export triggers download of .mockup.json', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export/i });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toContain('.mockup.json');
  });

  test('export includes document structure in downloaded file', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export/i });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    // Read the file content
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const content = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.version).toBe(1);
    expect(parsed.document).toBeDefined();
    expect(parsed.document.screens).toBeDefined();
    expect(parsed.document.screens.length).toBeGreaterThan(0);
  });
});
