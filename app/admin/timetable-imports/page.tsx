import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { timetableImports } from "@/lib/db/schema";
import { TimetableUploadForm } from "@/components/upload/TimetableUploadForm";
import { TimetableBookmarklet } from "@/components/upload/TimetableBookmarklet";
import { TimetableImportRow } from "@/components/upload/TimetableImportRow";

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

  // react-hooks/purity kuralı Date.now()'u genel olarak yasaklıyor (React
  // Compiler istemci bileşenlerinin birden fazla kez render edilebileceğini
  // varsayıyor). Ama bu bir Server Component: her HTTP isteğinde tam olarak
  // bir kez, sunucuda çalışıyor — "kaç gün önce yüklendi" hesabı için gerçek
  // zamanı okumak burada güvenli ve kasıtlı (Faz 4'ten beri böyleydi, bkz.
  // git geçmişi). Kural bu ayrımı bilmiyor; bilerek devre dışı bırakıldı.
  // eslint-disable-next-line react-hooks/purity -- Server Component'te istek başına bir kez okunuyor, gerçek bir yan etki değil
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  function isStaleImport(uploadedAt: Date): boolean {
    return now - uploadedAt.getTime() > THIRTY_DAYS_MS;
  }

  // TimetableBookmarklet edupage sayfasında çalışacağı için mutlak bir URL'e
  // ihtiyaç duyuyor. `window.location.origin`'i istemci tarafında bir
  // useEffect'te okumak (React Compiler'ın "impure/effect'te setState"
  // kurallarına takılmanın yanı sıra) sunucu/istemci hydration uyuşmazlığına
  // da yol açardı — bunun yerine gelen isteğin host başlığından sunucu
  // tarafında hesaplayıp saf bir prop olarak geçiyoruz.
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Ders Programı İçe Aktarmaları</h1>
        <p className="text-sm text-gray-500">
          Sınıf ders programlarını (edupage kayıtlarını) buradan yükleyin. Bu veriler
          uygunluk analizi ve çakışma tespiti için kullanılır.
        </p>
      </div>

      <TimetableBookmarklet baseUrl={baseUrl} />

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
                  <th className="py-2">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <TimetableImportRow
                    key={imp.id}
                    id={imp.id}
                    sourceLabel={imp.sourceLabel}
                    termCode={imp.termCode}
                    uploadedAt={imp.uploadedAt}
                    parsedSessionCount={imp.parsedSessionCount}
                    isStale={isStaleImport(imp.uploadedAt)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
