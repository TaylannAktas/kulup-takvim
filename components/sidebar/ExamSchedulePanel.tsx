import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions } from "@/lib/db/schema";
import { FACULTY_CODES } from "@/lib/scrapers/exam-schedule/fetch";
import { makeLayerId, isLayerActive } from "@/lib/calendar/layers";
import { getMonthGridDays, nextMonth, previousMonth } from "@/lib/calendar/date-utils";
import { ExamSessionSearchList } from "./ExamSessionSearchList";
import { FilterCheckboxRow } from "./FilterCheckboxRow";

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

type ExamSchedulePanelProps = {
  activeLayers: Set<string>;
  monthParam: string;
  dayParam?: string;
};

/**
 * Spec §6.3: fakülte + tür çoklu seçim filtresi, tarihe göre gruplanmış liste.
 *
 * "Vize 1 / Vize 2" ayrımı yok (spec'in uyardığı gibi kaynakta tek `arasinav`
 * var) — keşfedilen `exam_type` değerleri (arasinav/final/mazeret) olduğu gibi
 * gösteriliyor, sabit bir "Vize 1/2" varsayımı yapılmıyor.
 */
export async function ExamSchedulePanel({ activeLayers, monthParam, dayParam }: ExamSchedulePanelProps) {
  const activeFaculties = FACULTY_CODES.filter((code) =>
    isLayerActive(activeLayers, makeLayerId(FACULTY_NAMESPACE, code))
  );
  const activeTypes = (["arasinav", "final", "mazeret"] as const).filter((type) =>
    isLayerActive(activeLayers, makeLayerId(TYPE_NAMESPACE, type))
  );

  // exam_sessions gerçekte binlerce satıra çıkabiliyor (senkron dedup sorunu,
  // bkz. DECISIONS.md "Bilinen veri sorunları") — tüm tabloyu çekip 11 binden
  // fazla <li> render etmek sayfa yüklemesini 20+ saniyeye çıkarıyordu. Görünen
  // ay ± 1 ay penceresiyle DB'de sınırlıyoruz; fakülte/tür süzmesi (az sayıda
  // seçenek olduğu için) hâlâ bellekte yapılıyor.
  const [monthYear, monthIndex] = monthParam.split("-").map(Number);
  const monthAnchor = new Date(monthYear, (monthIndex || 1) - 1, 1);
  const windowStart = getMonthGridDays(previousMonth(monthAnchor))[0];
  const windowGridDays = getMonthGridDays(nextMonth(monthAnchor));
  const windowEnd = windowGridDays[windowGridDays.length - 1];

  const filters = [
    eq(examSessions.isActive, true),
    gte(examSessions.examDate, windowStart),
    lte(examSessions.examDate, windowEnd),
  ];
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
    const layersSuffix = next.size > 0 ? `&layers=${[...next].sort().join(",")}` : "";
    return `/calendar?month=${monthParam}${dayParam ? `&day=${dayParam}` : ""}${layersSuffix}`;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <ExamSessionSearchList rows={visibleRows}>
        <div>
          <p className="mb-1 text-xs font-medium text-gray-400">Fakülte</p>
          <div className="flex flex-col">
            {FACULTY_CODES.map((code) => (
              <FilterCheckboxRow
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
          <div className="flex flex-col">
            {Object.entries(EXAM_TYPE_LABELS).map(([type, label]) => (
              <FilterCheckboxRow
                key={type}
                href={toggleLayerHref(TYPE_NAMESPACE, type)}
                active={activeTypes.includes(type as "arasinav" | "final" | "mazeret")}
                label={label}
              />
            ))}
          </div>
        </div>
      </ExamSessionSearchList>
    </div>
  );
}
