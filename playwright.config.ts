import { defineConfig, devices } from '@playwright/test';
const base = process.env.BASE_PATH ?? '/chd-sheet/';
const chrome = process.env.CHROME_PATH;
export default defineConfig({
  testDir: 'e2e', timeout: 90_000,
  use: { baseURL: `http://localhost:4174${base}`, ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: chrome ? { executablePath: chrome } : {} },
  webServer: { command: 'npx vite preview --port 4174 --strictPort', url: `http://localhost:4174${base}`, reuseExistingServer: true, env: { BASE_PATH: base } },
  projects: [{ name: 'iphone', use: { browserName: 'chromium' } }],
});
