import { createHash } from "node:crypto";

/**
 * Bir kaydın alan değerlerinden kararlı (deterministic) bir hash üretir.
 * Alan sırası sabit olmalı — çağıran taraf her zaman aynı sırayla değer vermeli,
 * aksi halde aynı veri farklı hash üretip sahte "değişiklik" tespitine yol açar.
 */
export function hashRow(fields: Array<string | number | null | undefined>): string {
  const normalized = fields.map((f) => (f === null || f === undefined ? "" : String(f).trim())).join("");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
