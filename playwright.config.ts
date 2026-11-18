import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const chromium =
  process.env.CHROMIUM_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4187',
    viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath: chromium },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
    timeout: 90_000,
  },
  reporter: 'list',
})
