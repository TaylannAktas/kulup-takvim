import { defineConfig, devices } from "@playwright/test";

/**
 * Gerçek bir Google OAuth hesabı olmadan (bkz. Faz 0, henüz kurulmadı) test
 * edilebilenler: kimlik doğrulama kapısının davranışı (girişsiz erişim
 * reddediliyor mu) ve statik sayfaların render'ı. Gerçek oturum gerektiren
 * akışlar (etkinlik oluşturma vb.) Faz 0 tamamlanınca eklenecek — bkz.
 * DECISIONS.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: { AUTH_SECRET: "playwright-test-secret" },
    timeout: 60_000,
  },
});
