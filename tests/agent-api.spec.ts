import { test, expect } from '@playwright/test';

test.describe('Agent API (#7)', () => {
  test('builder produces valid mockup document', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });

    // Export the document and verify it matches the schema structure
    const exportBtn = page.getByRole('button', { name: /export/i });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const content = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.version).toBe(1);
    expect(parsed.document.screens.length).toBeGreaterThan(0);
    expect(parsed.document.screens[0].rootNode.type).toBeDefined();
    expect(parsed.document.colorScheme).toBeDefined();
    expect(Array.isArray(parsed.document.edges)).toBe(true);
  });

  test('schema served at /schema/mockup-document.schema.json', async ({ page }) => {
    const response = await page.request.get('/protota/schema/mockup-document.schema.json');
    expect(response.status()).toBe(200);
    const schema = await response.json();
    expect(schema.$id).toContain('mockup-document');
    expect(schema.$defs).toBeDefined();
  });
});
