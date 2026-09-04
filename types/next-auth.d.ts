import type { DefaultSession } from "next-auth";
import type { users } from "@/lib/db/schema";

type UserRole = (typeof users.$inferSelect)["role"];

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

/**
 * JWT augmentation'ı "@auth/core/jwt" üzerinden yapılmalı: next-auth/jwt.d.ts
 * `export * from "@auth/core/jwt"` ile yeniden dışa aktardığı için o modül adına
 * yazılan augmentation orijinal interface ile birleşmiyor (yeni bir JWT tanımlıyor).
 * Session için ise next-auth/index.d.ts adlandırılmış re-export kullandığından
 * "next-auth" modül adı doğru şekilde birleşiyor.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
