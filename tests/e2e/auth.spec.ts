import { test, expect } from "@playwright/test";

/**
 * Gerçek bir Google hesabıyla giriş, Faz 0 tamamlanana kadar (bkz. DECISIONS.md)
 * test ortamında mümkün değil. Burada sadece oturumdan bağımsız doğrulanabilecek
 * davranışlar var: kimlik doğrulama kapısının kendisi ve statik sayfaların render'ı.
 */

test("girişsiz istekte /calendar signin'e yönlendirir", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
});

test("girişsiz API isteği veri döndürmez", async ({ request }) => {
  const response = await request.get("/api/events");
  expect(response.status()).toBe(401);
  const body = await response.text();
  expect(body).toBe("");
});

test("signin sayfası Google ile giriş düğmesini gösterir", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
});

test("cron uç noktası CRON_SECRET olmadan çalışmaz", async ({ request }) => {
  const response = await request.get("/api/cron/sync-academic-calendar");
  expect(response.status()).toBe(401);
});

test("admin sayfaları girişsiz erişimde signin'e yönlendirir", async ({ page }) => {
  await page.goto("/admin/column-mapping");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
});
