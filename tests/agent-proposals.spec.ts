import { test, expect } from '@playwright/test';

type Handle = {
  propose: (fn: () => void, label?: string) => unknown;
};

test.describe('Agent proposals (#500)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  // The store is not on window; the dev server exposes it as a module under the vite base (/protota/).
  const proposeAddScreen = (page: import('@playwright/test').Page) => page.evaluate(async () => {
    const mod = await import('/protota/src/store/mockupStore.ts');
    const w = window as unknown as { protota: Handle };
    w.protota.propose(() => mod.useMockupStore.getState().addScreen('Proposed', 'standard'), 'Add screen');
  });

  test('reject leaves the document alone; accept is one undo step; stale is refused', async ({ page }) => {
    const count = () => page.evaluate(async () => {
      const mod = await import('/protota/src/store/mockupStore.ts');
      return mod.useMockupStore.getState().doc.screens.length;
    });
    const start = await count();

    await proposeAddScreen(page);
    const card = page.getByTestId('proposal-review');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('proposal-preview')).toBeVisible();
    expect(await count()).toBe(start);
    await page.getByTestId('proposal-reject').click();
    await expect(card).toBeHidden();
    expect(await count()).toBe(start);

    await proposeAddScreen(page);
    await page.getByTestId('proposal-accept').click();
    await expect(card).toBeHidden();
    expect(await count()).toBe(start + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(count).toBe(start);

    await proposeAddScreen(page);
    await expect(card).toBeVisible();
    await page.evaluate(async () => {
      const mod = await import('/protota/src/store/mockupStore.ts');
      mod.useMockupStore.getState().addScreen('Human', 'standard');
    });
    await expect(card).toBeHidden();
    expect(await count()).toBe(start + 1);
  });
});
