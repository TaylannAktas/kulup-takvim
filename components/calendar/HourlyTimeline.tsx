"use client";

import { getEventStyle, EventKind } from "@/lib/calendar/color-system";

export type TimelineItem = {
  id: string;
  label: string;
  kind: EventKind;
  startMinutes: number;
  endMinutes: number;
  /** Gün ayrıntısındaki tür bölümü — kapatılınca öğeler tek satıra indirilir (bkz. lib/calendar/grouping.ts). */
  group?: "exam" | "course" | "event";
  /** Hover metni: birleştirilmiş şube/salon dökümü. */
  detail?: string;
};

/** Okulun gerçek "ders saati" (period) sınırı — bkz. lib/calendar/day-detail.ts. */
export type TimelinePeriod = {
  startMinutes: number;
  endMinutes: number;
  label: string;
};

type HourlyTimelineProps = {
  items: TimelineItem[];
  startHour?: number;
  endHour?: number;
  /**
   * Bilinen ders saatleri varsa çizelge bunlara göre bölünür (okulun
   * sitesindeki gibi) — üst şerit her period için ayrı bir sütun başlığı
   * gösterir, dikey çizgiler period sınırlarına oturur. Boşsa (ders programı
   * katmanı seçili değil, ya da eski bir içe aktarmada period kaydı yok)
   * genel saat/yarım saat ızgarasına düşülür. Öğelerin (ders/sınav/etkinlik)
   * yerleşimi bundan ETKİLENMEZ — hep gerçek saatine göre orantılı konumlanır.
   */
  periods?: TimelinePeriod[];
  /**
   * O günü etkileyen akademik takvim kayıtları — saate bağlı olmadıkları için
   * saat eksenine göre konumlanmıyorlar, çizelgenin EN ALTINDA tam genişlikte
   * birer çizgi olarak listeleniyorlar (kullanıcı isteği, 2026-09-08).
   */
  academicEntries?: Array<{ id: string; label: string; kind: EventKind }>;
};

/**
 * Assigns items to columns for overlap handling. Returns an array of
 * { item, column, columnCount } for each item, where column is 0-indexed
 * and columnCount is the total number of columns used by this item's
 * overlap *cluster* (a maximal run of mutually-touching items — not just
 * pairwise overlap — so every item in the cluster gets the same width).
 *
 * Algorithm: sort by startMinutes, sweep to split into clusters (a cluster
 * ends when an item starts at/after the max end time seen so far in the
 * current cluster), then within each cluster greedily assign the first
 * column whose previous occupant has already ended.
 */
export function assignColumnsForOverlap(
  items: TimelineItem[]
): Array<{
  item: TimelineItem;
  column: number;
  columnCount: number;
}> {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes);

  const result: Array<{ item: TimelineItem; column: number; columnCount: number }> = [];

  let clusterStart = 0;
  let clusterMaxEnd = sorted[0].endMinutes;

  const flushCluster = (fromIndex: number, toIndex: number) => {
    const columnEndTimes: number[] = [];
    const columnByIndex: number[] = [];

    for (let i = fromIndex; i <= toIndex; i++) {
      const item = sorted[i];
      let assignedColumn = columnEndTimes.findIndex((end) => end <= item.startMinutes);
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(item.endMinutes);
      } else {
        columnEndTimes[assignedColumn] = item.endMinutes;
      }
      columnByIndex.push(assignedColumn);
    }

    const columnCount = columnEndTimes.length;
    for (let i = fromIndex; i <= toIndex; i++) {
      result.push({ item: sorted[i], column: columnByIndex[i - fromIndex], columnCount });
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinutes >= clusterMaxEnd) {
      flushCluster(clusterStart, i - 1);
      clusterStart = i;
      clusterMaxEnd = sorted[i].endMinutes;
    } else {
      clusterMaxEnd = Math.max(clusterMaxEnd, sorted[i].endMinutes);
    }
  }
  flushCluster(clusterStart, sorted.length - 1);

  return result;
}

/**
 * Clamps a time value to the visible range [startMinutes, endMinutes].
 */
function clampTime(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts minutes-since-midnight to a percentage of the visible time range.
 * Zaman ekseni artık YATAY (bkz. aşağıdaki bileşen); yüzde kullanmak (sabit
 * piksel yerine) genişliği ne olursa olsun kapsayıcıya tam otursun diye —
 * yatayda kaydırma çubuğu istemiyoruz, dikeyde (üst üste binen oturumlar
 * çoğaldığında) hâlâ kaydırılabilir.
 */
function minutesToPercent(minutes: number, startMinutes: number, endMinutes: number): number {
  const totalMinutes = endMinutes - startMinutes;
  const offsetMinutes = minutes - startMinutes;
  return (offsetMinutes / totalMinutes) * 100;
}

/** `570` (dakika) → `"9.30"` — kullanıcının istediği biçim (nokta, başında sıfır yok). */
function formatDotTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}.${String(m).padStart(2, "0")}`;
}

/** Üst üste binen oturumların dizildiği satırın sabit yüksekliği. */
const ROW_HEIGHT_PX = 28;

export function HourlyTimeline({
  items,
  startHour = 8,
  endHour = 22,
  periods = [],
  academicEntries = [],
}: HourlyTimelineProps) {
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const hasPeriods = periods.length > 0;

  // Bilinen ders saatleri varsa dikey çizgiler period sınırlarına (her
  // period'un başı VE sonu) oturur — aralardaki teneffüsler böylece görsel
  // olarak da ayrı bir dilim gibi durur. Yoksa eski genel saat/yarım saat ızgarası.
  const gridLines: Array<{ minutes: number; isHour: boolean }> = [];
  if (hasPeriods) {
    for (const period of periods) {
      gridLines.push({ minutes: period.startMinutes, isHour: true });
      gridLines.push({ minutes: period.endMinutes, isHour: true });
    }
  } else {
    for (let h = startHour; h <= endHour; h++) {
      gridLines.push({ minutes: h * 60, isHour: true });
      if (h < endHour) {
        gridLines.push({ minutes: h * 60 + 30, isHour: false });
      }
    }
  }

  // Clip items to visible range
  const visibleItems = items
    .map((item) => ({
      ...item,
      startMinutes: clampTime(item.startMinutes, startMinutes, endMinutes),
      endMinutes: clampTime(item.endMinutes, startMinutes, endMinutes),
    }))
    .filter((item) => item.startMinutes < item.endMinutes); // Exclude fully-clipped items

  // `column`/`columnCount` yön bağımsız bir "şerit" ataması — burada yatay
  // eksende zaman aktığı için bunlar artık dikey SATIR indeksi/sayısı olarak
  // kullanılıyor (bkz. assignColumnsForOverlap'ın kendi testleri, yön
  // varsaymıyor).
  const itemsWithLayout = assignColumnsForOverlap(visibleItems);
  const rowCount =
    itemsWithLayout.length > 0 ? Math.max(...itemsWithLayout.map((i) => i.columnCount)) : 1;
  const bodyHeightPx = Math.max(rowCount * ROW_HEIGHT_PX, 60);

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden bg-white dark:bg-gray-950">
      {/* Üst şerit: period biliniyorsa her ders saati kendi sütun başlığı (kaçıncı ders + saat), yoksa nokta saat etiketleri */}
      <div className="relative h-9 shrink-0 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        {hasPeriods
          ? periods.map((period, i) => {
              const clippedStart = clampTime(period.startMinutes, startMinutes, endMinutes);
              const clippedEnd = clampTime(period.endMinutes, startMinutes, endMinutes);
              if (clippedEnd <= clippedStart) return null; // görünür aralığın tamamen dışında
              const leftPct = minutesToPercent(clippedStart, startMinutes, endMinutes);
              const widthPct = minutesToPercent(clippedEnd, startMinutes, endMinutes) - leftPct;
              return (
                <div
                  key={`period-${i}`}
                  title={period.label}
                  className="absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden whitespace-nowrap border-r border-gray-200 px-0.5 leading-tight text-gray-700 last:border-r-0 dark:border-gray-800 dark:text-gray-300"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  <span className="text-[10px] font-semibold">{i + 1}. Ders</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {formatDotTime(period.startMinutes)}
                  </span>
                </div>
              );
            })
          : Array.from({ length: endHour - startHour + 1 }).map((_, i) => {
              const hour = startHour + i;
              const isFirst = hour === startHour;
              const isLast = hour === endHour;
              return (
                <div
                  key={`hour-${hour}`}
                  className="absolute top-0 whitespace-nowrap text-xs font-medium text-gray-600 dark:text-gray-400"
                  style={{
                    left: `${minutesToPercent(hour * 60, startMinutes, endMinutes)}%`,
                    transform: isFirst ? undefined : isLast ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {`${String(hour).padStart(2, "0")}:00`}
                </div>
              );
            })}
      </div>

      {/* Zaman çizelgesi gövdesi */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-950">
        <div style={{ height: `${bodyHeightPx}px`, position: "relative" }}>
          {/* Gridlines (30-minute intervals) — artık dikey çizgiler */}
          {gridLines.map(({ minutes, isHour }) => (
            <div
              key={`grid-${minutes}`}
              className={`absolute top-0 bottom-0 ${
                isHour
                  ? "border-l border-gray-300 dark:border-gray-700"
                  : "border-l border-gray-100 dark:border-gray-800"
              }`}
              style={{
                left: `${minutesToPercent(minutes, startMinutes, endMinutes)}%`,
              }}
            />
          ))}

          {/* Timeline items */}
          {itemsWithLayout.map(({ item, column }) => {
            const leftPct = minutesToPercent(item.startMinutes, startMinutes, endMinutes);
            const widthPct = minutesToPercent(item.endMinutes, startMinutes, endMinutes) - leftPct;
            const topPx = column * ROW_HEIGHT_PX;

            const style = getEventStyle(item.kind);

            return (
              <div
                key={item.id}
                className={`absolute overflow-hidden rounded ${style.barClassName} flex items-center gap-1 px-1.5 text-xs font-medium`}
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 1)}%`,
                  top: `${topPx}px`,
                  height: `${ROW_HEIGHT_PX - 3}px`,
                }}
                title={item.detail ? `${item.label}\n${item.detail}` : item.label}
              >
                {/* Icon + Label: always show both for accessibility (color-blind users, B&W printing) */}
                <span>{style.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* En alt bölüm: akademik takvim kayıtları saate bağlı olmadığı için ayrı,
          tam genişlikte çizgiler olarak (kullanıcı isteği, 2026-09-08) — saat
          eksenindeki gövdeden bağımsız, her zaman görünür bir alt şerit. */}
      {academicEntries.length > 0 && (
        <div className="flex shrink-0 flex-col gap-0.5 border-t border-gray-200 p-1 dark:border-gray-800">
          {academicEntries.map((entry) => {
            const style = getEventStyle(entry.kind);
            return (
              <div
                key={entry.id}
                title={`${style.label}: ${entry.label}`}
                className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${style.barClassName}`}
              >
                <span>{style.icon}</span>
                <span className="truncate">{entry.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
