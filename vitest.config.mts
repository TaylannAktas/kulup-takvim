import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot.replace(/[\\/]$/, ""),
      // `server-only` Node altında import edilir edilmez hata fırlatıyor
      // (sadece Next.js "react-server" koşulunda boş modüle çözülüyor).
      // Testlerde paketin kendi boş dosyasına yönlendiriyoruz.
      "server-only": `${projectRoot.replace(/[\\/]$/, "")}/node_modules/server-only/empty.js`,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
