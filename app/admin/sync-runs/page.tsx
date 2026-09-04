import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncRuns, syncChanges } from "@/lib/db/schema";

const SOURCE_LABELS: Record<string, string> = {
  akademik_takvim: "Akademik Takvim",
  sinav_programi: "Sınav Programı",
};

const STATUS_LABELS: Record<string, string> = {
  ok: "Başarılı",
  kismi: "Kısmi (uyarılı)",
  hata: "Hata",
  needs_mapping: "Elle eşleme gerekiyor",
};

const STATUS_COLORS: Record<string, string> = {
  ok: "text-green-700 dark:text-green-400",
  kismi: "text-yellow-700 dark:text-yellow-400",
  hata: "text-red-700 dark:text-red-400",
  needs_mapping: "text-orange-700 dark:text-orange-400",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  eklendi: "Eklendi",
  silindi: "Silindi/Pasifleşti",
  guncellendi: "Güncellendi",
};

export default async function SyncRunsAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return <div className="p-6 text-sm text-gray-500">Bu sayfa yalnızca admin rolüne açık.</div>;
  }

  const [runs, changes] = await Promise.all([
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50),
    db.select().from(syncChanges).limit(50),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-lg font-semibold">Senkron Geçmişi</h1>
        <p className="text-sm text-gray-500">
          Cron ve manuel tetiklemelerin çalışma kaydı. "Elle eşleme gerekiyor" durumundaki
          sınav programı kaynakları için{" "}
          <a href="/admin/column-mapping" className="underline">
            sütun eşleme ekranını
          </a>{" "}
          kullanın.
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
            <th className="py-1.5 pr-2">Kaynak</th>
            <th className="py-1.5 pr-2">Başladı</th>
            <th className="py-1.5 pr-2">Durum</th>
            <th className="py-1.5 pr-2">Çekilen</th>
            <th className="py-1.5 pr-2">Değişen</th>
            <th className="py-1.5">Not</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-100 align-top dark:border-gray-900">
              <td className="py-1.5 pr-2">{SOURCE_LABELS[run.source] ?? run.source}</td>
              <td className="py-1.5 pr-2 text-xs text-gray-500">
                {run.startedAt.toLocaleString("tr-TR")}
              </td>
              <td className={`py-1.5 pr-2 font-medium ${STATUS_COLORS[run.status] ?? ""}`}>
                {STATUS_LABELS[run.status] ?? run.status}
              </td>
              <td className="py-1.5 pr-2">{run.fetchedCount ?? "—"}</td>
              <td className="py-1.5 pr-2">{run.changedCount ?? "—"}</td>
              <td className="max-w-xs py-1.5 text-xs text-gray-500">
                {run.errorDetail ? (
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap">{run.errorDetail}</pre>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-xs text-gray-400">
                Henüz senkron çalıştırılmadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Son değişiklikler ({changes.length})
        </h2>
        <ul className="flex flex-col gap-1 text-xs text-gray-500">
          {changes.map((change) => (
            <li key={change.id} className="border-b border-gray-100 py-1 dark:border-gray-800">
              <span className="font-medium">{CHANGE_TYPE_LABELS[change.changeType] ?? change.changeType}</span>{" "}
              {change.entityType} ({change.entityId.slice(0, 8)})
            </li>
          ))}
          {changes.length === 0 && <li>Henüz kayıtlı değişiklik yok.</li>}
        </ul>
      </div>
    </div>
  );
}
