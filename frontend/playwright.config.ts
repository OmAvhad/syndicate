import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge', headless: true },
  webServer: { command: process.env.POOL_TEST_DEV ? 'npm run dev -- --host 127.0.0.1 --port 4175' : 'npm run preview -- --host 127.0.0.1 --port 4175', url: 'http://127.0.0.1:4175', reuseExistingServer: false },
})
