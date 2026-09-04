/**
 * `config/rooms-seed.ts` içindeki başlangıç derslik listesini veritabanına
 * yazar (upsert — var olanın bina/kapasite bilgisini ezmez, sadece eksikse doldurur).
 *
 * Çalıştırma: npx tsx scripts/seed-rooms.ts
 */
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { ROOMS_SEED } from "@/config/rooms-seed";
import { eq } from "drizzle-orm";

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const room of ROOMS_SEED) {
    const [existing] = await db.select().from(rooms).where(eq(rooms.code, room.code));
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.insert(rooms).values(room);
    inserted += 1;
  }

  console.log(`Derslikler: ${inserted} eklendi, ${skipped} zaten vardı (atlandı).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Derslik seed hatası:", error);
    process.exit(1);
  });
