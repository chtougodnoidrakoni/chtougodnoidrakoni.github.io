import { defineConfig, devices } from '@playwright/test';
const base = process.env.BASE_PATH ?? '/chd-sheet/';
const chrome = process.env.CHROME_PATH;
export default defineConfig({
  testDir: 'e2e', timeout: 90_000,
  use: { baseURL: `http://localhost:4174${base}`, ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: chrome ? { executablePath: chrome } : {} },
  webServer: [
    { command: 'npx vite preview --port 4174 --strictPort', url: `http://localhost:4174${base}`, reuseExistingServer: true, env: { BASE_PATH: base } },
    // сервер записей Telegram-приложения: тот же код, что в Cloudflare, база в памяти
    { command: 'npx esbuild tools/games-dev.ts --bundle --platform=node --format=esm --outfile=tools/.games-dev.mjs --log-level=warning && node tools/.games-dev.mjs', url: 'http://localhost:8787/', reuseExistingServer: true },
  ],
  projects: [{ name: 'iphone', use: { browserName: 'chromium' } }],
});
