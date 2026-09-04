import "server-only";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

/**
 * Kaba taneli denetim kaydı (spec §7.4): kim, ne zaman, hangi kaydı nasıl
 * değiştirdi. Alan bazlı diff görüntüleyici yok — before/after jsonb olarak
 * saklanıyor, ileride gerekirse üstüne bir arayüz kurulabilir.
 */
export async function logAudit(params: {
  userId: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    diff: { before: params.before ?? null, after: params.after ?? null },
  });
}
