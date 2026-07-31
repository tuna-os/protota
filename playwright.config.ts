import { defineConfig, devices } from '@playwright/test';

// Overridable so parallel worktrees don't fight over (or silently reuse)
// one another's dev server on the default port.
const port = Number(process.env.PROTOTA_PORT ?? 5173);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
