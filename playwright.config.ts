import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Overridable so parallel worktrees don't fight over (or silently reuse)
// one another's dev server on the default port.
const port = Number(process.env.PROTOTA_PORT ?? 5173);

interface AutoQaPolicy {
  playwright: {
    retries: {
      minimum: number;
      maximum: number;
      current: number;
    };
  };
}

const autoQaPolicy = JSON.parse(
  readFileSync(new URL('./.github/auto-qa-tuning.json', import.meta.url), 'utf8'),
) as AutoQaPolicy;
const retryPolicy = autoQaPolicy.playwright.retries;
if (!Number.isInteger(retryPolicy.current)
  || retryPolicy.current < retryPolicy.minimum
  || retryPolicy.current > retryPolicy.maximum) {
  throw new Error('Invalid Playwright retry policy in .github/auto-qa-tuning.json');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? retryPolicy.current : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  // Broadway comparisons are review artifacts even when the measurement test
  // passes; retain their native, Protota, diff, and JSON outputs for CI.
  preserveOutput: 'always',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
