import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbClient | null = null;

/**
 * DATABASE_URL modül yüklenirken değil, ilk gerçek sorguda okunur/kontrol edilir.
 * Aksi halde bu modülü statik import eden her route/bileşen, DATABASE_URL
 * ortam değişkeni yokken (örn. yerel build, CI) build'i kırar — DB'ye hiç
 * dokunmasa bile. `db` aşağıda bir Proxy olarak dışa aktarılıyor ki çağıran
 * kod `db.select()...` yazmaya devam edebilsin.
 */
function getDb(): DbClient {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL ortam değişkeni tanımlı değil.");
    }
    const sql = neon(process.env.DATABASE_URL);
    cached = drizzle(sql, { schema });
  }
  return cached;
}

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
