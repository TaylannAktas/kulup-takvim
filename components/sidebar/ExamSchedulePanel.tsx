import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions } from "@/lib/db/schema";
import { FACULTY_CODES } from "@/lib/scrapers/exam-schedule/fetch";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";

const FACULTY_LABELS: Record<string, string> = {
  servis: "Servis",
  muh: "Mühendislik",
  isletme: "İşletme",
  cav: "Sivil Hav.",
  fef: "FEF",
  saglik: "Sağlık",
  shmyo: "SHMYO",
  gsmf: "GSMF",
  gsod: "GSOD",
  etp: "E-Ticaret/Paz.",
  hukuk: "Hukuk",
  pilotaj: "Pilotaj",
};

const EXAM_TYPE_LABELS: Record<string, string> = {
  arasinav: "Ara Sınav",
  final: "Final",
  mazeret: "Mazeret",
};

const FACULTY_NAMESPACE = "exam-faculty";
const TYPE_NAMESPACE = "exam-type";

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={[
        "rounded-full border px-2 py-0.5 text-xs",
        active
          ? "border-orange-600 bg-orange-600 text-white"
          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

type ExamSchedulePanelProps = {
  activeLayers: Set<string>;
};

/**
 * Spec §6.3: fakülte + tür çoklu seçim filtresi, tarihe göre gruplanmış liste.
 *
 * "Vize 1 / Vize 2" ayrımı yok (spec'in uyardığı gibi kaynakta tek `arasinav`
 * var) — keşfedilen `exam_type` değerleri (arasinav/final/mazeret) olduğu gibi
 * gösteriliyor, sabit bir "Vize 1/2" varsayımı yapılmıyor.
 */
export async function ExamSchedulePanel({ activeLayers }: ExamSchedulePanelProps) {
  const activeFaculties = FACULTY_CODES.filter((code) =>
    isLayerActive(activeLayers, makeLayerId(FACULTY_NAMESPACE, code))
  );
  const activeTypes = (["arasinav", "final", "mazeret"] as const).filter((type) =>
    isLayerActive(activeLayers, makeLayerId(TYPE_NAMESPACE, type))
  );

  const filters = [eq(examSessions.isActive, true)];
  // Not: Drizzle'da IN yerine basit eşitlik zincirlemek için OR gerekir; küçük
  // filtre sayısı olduğundan sorguyu DB'de tam filtrelemek yerine, sonucu
  // (aktif kayıtları) çekip bellekte filtreliyoruz — tablo boyutu bir dönem
  // için birkaç yüz satırı geçmiyor (bkz. DECISIONS.md ölçümleri).
  const rows = await db
    .select()
    .from(examSessions)
    .where(and(...filters))
    .orderBy(asc(examSessions.examDate), asc(examSessions.startTime));

  const visibleRows = rows.filter((row) => {
    if (activeFaculties.length > 0 && !activeFaculties.includes(row.facultyCode as (typeof FACULTY_CODES)[number])) {
      return false;
    }
    if (activeTypes.length > 0 && !activeTypes.includes(row.examType)) {
      return false;
    }
    return true;
  });

  function toggleLayerHref(namespace: string, value: string) {
    const id = makeLayerId(namespace, value);
    const next = new Set(activeLayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return `?layers=${[...next].sort().join(",")}`;
  }

  const grouped = new Map<string, typeof visibleRows>();
  for (const row of visibleRows) {
    const key = row.examDate ? row.examDate.toISOString().slice(0, 10) : "tarih-yok";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p className="mb-1 text-xs font-medium text-gray-400">Fakülte</p>
        <div className="flex flex-wrap gap-1">
          {FACULTY_CODES.map((code) => (
            <FilterChip
              key={code}
              href={toggleLayerHref(FACULTY_NAMESPACE, code)}
              active={activeFaculties.includes(code)}
              label={FACULTY_LABELS[code] ?? code}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-400">Tür</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(EXAM_TYPE_LABELS).map(([type, label]) => (
            <FilterChip
              key={type}
              href={toggleLayerHref(TYPE_NAMESPACE, type)}
              active={activeTypes.includes(type as "arasinav" | "final" | "mazeret")}
              label={label}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {[...grouped.entries()].map(([dateKey, sessions]) => (
          <div key={dateKey} className="py-2">
            <div className="mb-1 text-xs font-semibold text-gray-500">
              {dateKey === "tarih-yok"
                ? "Tarih yok"
                : new Date(dateKey).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <ul className="flex flex-col gap-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={
                      session.examDate
                        ? `/calendar?month=${session.examDate.getFullYear()}-${String(session.examDate.getMonth() + 1).padStart(2, "0")}`
                        : "#"
                    }
                    className="flex items-center gap-1.5 hover:underline"
                  >
                    <span className="text-xs text-gray-500">{session.startTime ?? "--:--"}</span>
                    <span className="font-medium">{session.courseCode ?? "?"}</span>
                    <span className="text-xs text-gray-400">{session.room ?? ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {visibleRows.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Kayıt yok</p>
        )}
      </div>
    </div>
  );
}
