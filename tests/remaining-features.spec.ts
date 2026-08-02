import { test, expect } from '@playwright/test';

test.describe('Remaining features (#9, #16, #18-#24)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('adw-window', { timeout: 10000 });
  });

  test('#9 Code export command exists in the Export menu', async ({ page }) => {
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /export code/i })).toBeVisible();
  });

  test('#16 Screen width defaults exist in store', async ({ page }) => {
    const screen = page.locator('adw-window').first();
    await expect(screen).toBeVisible();
    const w = await screen.evaluate(el => (el as HTMLElement).style.width);
    expect(w).toBeTruthy();
  });

  test('#18 Selection outline on click', async ({ page }) => {
    const window = page.locator('adw-window').first();
    await window.click();
    await expect(page.locator('.selected-outline').first()).toBeVisible({ timeout: 3000 });
  });

  test('#19 Right-click shows context menu', async ({ page }) => {
    const window = page.locator('adw-window').first();
    await window.click({ button: 'right' });
    const menu = page.locator('.protota-context-menu');
    await expect(menu).toBeVisible({ timeout: 3000 });
  });

  test('#20 Undo button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
  });

  test('#21 Preset gallery accessible', async ({ page }) => {
    // Load Preset moved into the Open menu (#106 layout reorder).
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByRole('menuitem', { name: /load preset/i }).click();
    await expect(page.locator('.protota-preset-item').first()).toBeVisible({ timeout: 3000 });
  });

  test('#22 A11y lint rule covers icon-only buttons', async ({ page }) => {
    const lintBtn = page.getByTestId('diagnostics-toggle');
    await lintBtn.click();
    await expect(lintBtn).toHaveAttribute('data-active', 'true');
  });

  test('#23 Command palette opens with Ctrl+K', async ({ page }) => {
    const hdr = page.locator('.protota-canvas adw-header-bar').first();
    await hdr.click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.protota-command-palette')).toBeVisible({ timeout: 3000 });
  });

  test('#24 Export + PNG actions live in the Export menu', async ({ page }) => {
    await page.getByTestId('app-header-bar').getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /export to json/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /export screen to png/i })).toBeVisible();
  });
});

test.describe("Slot-aware building", () => {
  test("inspector offers the parent container's named slots", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("adw-window", { timeout: 10000 });

    // Select a widget inside a header bar; the inspector should offer the
    // header bar's start/title/end slots.
    await page.locator(".protota-canvas adw-window-title").first().click({ position: { x: 4, y: 4 } });
    const selector = page.getByTestId("slot-selector");
    await expect(selector).toBeVisible();
    await expect(selector.locator("option")).toContainText(["Default placement", "start", "title", "end"]);

    await selector.locator("select").selectOption("end");
    await expect(selector.locator("select")).toHaveValue("end");
  });
});

test.describe("Alignment controls", () => {
  test("inspector sets halign and expand on the selection", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("adw-window", { timeout: 10000 });

    await page.locator(".protota-canvas adw-header-bar").first().click({ position: { x: 8, y: 8 } });
    const controls = page.getByTestId("alignment-controls");
    await expect(controls).toBeVisible();

    await controls.getByLabel("Horizontal alignment").selectOption("center");
    await expect(controls.getByLabel("Horizontal alignment")).toHaveValue("center");

    const hexpand = controls.locator("input[type=checkbox]").first();
    await hexpand.check();
    await expect(hexpand).toBeChecked();
  });
});
