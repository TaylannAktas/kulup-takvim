import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sourceColumnMapping } from "@/lib/db/schema";
import { ColumnMappingEditor } from "@/components/column-mapping/ColumnMappingEditor";

export default async function ColumnMappingAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return (
      <div className="p-6 text-sm text-gray-500">
        Bu sayfa yalnızca admin rolüne açık.
      </div>
    );
  }

  const existing = await db
    .select()
    .from(sourceColumnMapping)
    .orderBy(desc(sourceColumnMapping.createdAt));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Sınav Programı Sütun Eşlemesi</h1>
        <p className="text-sm text-gray-500">
          Sınav programı kaynağının sütun sırası otomatik tespit edilemediğinde
          buradan elle eşlenir. Bir kez kaydedilen eşleme sonraki senkronlarda
          otomatik kullanılır.
        </p>
      </div>

      <ColumnMappingEditor />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Kayıtlı eşlemeler ({existing.length})
        </h2>
        <ul className="flex flex-col gap-1 text-xs text-gray-500">
          {existing.map((row) => (
            <li key={row.id} className="border-b border-gray-100 py-1 dark:border-gray-800">
              {row.sourceUrlPattern} — {new Date(row.createdAt).toLocaleString("tr-TR")}
            </li>
          ))}
          {existing.length === 0 && <li>Henüz kayıtlı eşleme yok.</li>}
        </ul>
      </div>
    </div>
  );
}
