import { defineConfig } from "drizzle-kit";

// drizzle-kit (Next.js'in aksine) .env.local'ı otomatik okumuyor; Node'un
// yerleşik loadEnvFile'ı ile ek bağımlılık eklemeden yüklüyoruz. Dosya yoksa
// (örn. CI/Vercel'de gerçek ortam değişkenleri zaten ayarlıysa) sessizce geç.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
