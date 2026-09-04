import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { timetableImports } from "@/lib/db/schema";
import { TimetableUploadForm } from "@/components/upload/TimetableUploadForm";

export default async function TimetableImportsAdminPage() {
  const session = await auth();
  if (session?.user?.role === "viewer" || !session?.user) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Bu sayfa yalnızca editor ve admin rollerine açık.
      </div>
    );
  }

  const imports = await db
    .select()
    .from(timetableImports)
    .orderBy(desc(timetableImports.uploadedAt));

  // Helper to check if an import is stale (more than 30 days old)
  function isStaleImport(uploadedAt: Date): boolean {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - uploadedAt.getTime() > thirtyDaysMs;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Ders Programı İçe Aktarmaları</h1>
        <p className="text-sm text-gray-500">
          Sınıf ders programlarını (edupage kayıtlarını) buradan yükleyin. Bu veriler
          uygunluk analizi ve çakışma tespiti için kullanılır.
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <TimetableUploadForm />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Yüklenen Kayıtlar ({imports.length})
        </h2>
        {imports.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz ders programı yüklenmedi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                  <th className="py-2 pr-3">Kaynak</th>
                  <th className="py-2 pr-3">Dönem</th>
                  <th className="py-2 pr-3">Yükleme Tarihi</th>
                  <th className="py-2 pr-3">Oturum Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => {
                  const stale = isStaleImport(imp.uploadedAt);
                  return (
                    <tr
                      key={imp.id}
                      className="border-b border-gray-100 dark:border-gray-900"
                    >
                      <td className="py-2 pr-3">{imp.sourceLabel || "—"}</td>
                      <td className="py-2 pr-3">{imp.termCode || "—"}</td>
                      <td
                        className={`py-2 pr-3 text-xs ${
                          stale ? "text-amber-600 dark:text-amber-400" : "text-gray-600"
                        }`}
                      >
                        {imp.uploadedAt.toLocaleString("tr-TR")}
                        {stale && (
                          <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            30+ gün
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{imp.parsedSessionCount ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
