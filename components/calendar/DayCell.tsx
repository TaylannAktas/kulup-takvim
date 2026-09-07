import Link from "next/link";
import { formatDayNumber, isSameDay, isSameMonth, isWeekend } from "@/lib/calendar/date-utils";
import { getEventStyle, type EventKind } from "@/lib/calendar/color-system";
import type { AcademicEdge } from "@/lib/calendar/month-events";

type DayCellProps = {
  day: Date;
  monthAnchor: Date;
  today: Date;
  dominantKind: EventKind | null;
  /** Bu güne denk gelen ama hafta şeridi olarak değil hücre içinde gösterilecek satırlar (spec "+2 daha" taşması). */
  overflowCount: number;
  /** Bu güne iliştirilmiş bir gün notu var mı — sağ üst köşede sarı üçgen işareti (spec §6.5). */
  hasNote?: boolean;
  /**
   * Bu gün bir akademik takvim kaydının başlangıcı ve/veya bitişi mi — metin/
   * şerit değil, sadece SOL (başlangıç) ve/veya SAĞ (bitiş) kenar çerçevesi
   * (kullanıcı isteği, 2026-09-08: kapsanan HER günü çerçevelemek de kalabalık
   * yaratıyordu, sadece sınır günleri işaretleniyor).
   */
  academicEdge?: AcademicEdge;
  /**
   * "Isı haritası" katmanı açık mı — açıkken günün baskın türüne göre TÜM
   * türler için hücre zemini hafifçe tonlanır (varsayılan KAPALI, kullanıcı
   * isteği 2026-09-08). Kapalıyken davranış bu özellikten önceki hâliyle
   * birebir aynı (sadece 2 tür zaten `cellBackgroundClassName` tanımlıyordu).
   */
  heatmapOn?: boolean;
  href?: string;
  selected?: boolean;
  /** 0-based index in the flattened month grid for keyboard navigation (spec §7.6). */
  dayIndex?: number;
};

export function DayCell({
  day,
  monthAnchor,
  today,
  dominantKind,
  overflowCount,
  hasNote,
  academicEdge,
  heatmapOn,
  href,
  selected,
  dayIndex,
}: DayCellProps) {
  const inCurrentMonth = isSameMonth(day, monthAnchor);
  const isToday = isSameDay(day, today);
  const weekend = isWeekend(day);
  const dominantStyle = dominantKind ? getEventStyle(dominantKind) : null;
  const frameStart = academicEdge?.start ? getEventStyle(academicEdge.start).frameStartClassName : undefined;
  const frameEnd = academicEdge?.end ? getEventStyle(academicEdge.end).frameEndClassName : undefined;
  const backgroundTint = heatmapOn
    ? dominantStyle?.heatmapBackgroundClassName
    : dominantStyle?.cellBackgroundClassName;

  const className = [
    "relative flex min-h-24 flex-col gap-1 border border-gray-200 p-1.5 dark:border-gray-800",
    frameStart ?? "",
    frameEnd ?? "",
    inCurrentMonth ? "bg-white dark:bg-gray-950" : "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600",
    weekend && inCurrentMonth ? "bg-gray-50/70 dark:bg-gray-900/40" : "",
    inCurrentMonth && backgroundTint ? backgroundTint : "",
    href ? "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-blue-400" : "",
    selected ? "ring-2 ring-inset ring-blue-600" : "",
  ].join(" ");

  const content = (
    <>
      {hasNote && (
        <span
          title="Bu güne not eklendi"
          aria-label="Bu güne not eklendi"
          className="absolute right-0 top-0 h-0 w-0 border-t-[11px] border-l-[11px] border-t-yellow-400 border-l-transparent dark:border-t-yellow-500"
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className={[
            "self-start rounded-full px-1.5 text-sm",
            isToday ? "bg-blue-600 font-semibold text-white" : "",
          ].join(" ")}
        >
          {formatDayNumber(day)}
        </span>
        {dominantStyle && (
          <span className="text-[10px] text-gray-500" title={dominantStyle.label}>
            {dominantStyle.icon}
          </span>
        )}
      </div>
      <div className="mt-auto" />
      {/* Ders/etkinlik şeritleri (MonthGrid'de absolute konumlanmış, top-6'dan başlayıp
          en fazla 3 satır) ile üst üste binmesin diye (kullanıcı raporu, 2026-09-07)
          fazladan üst boşluk — hücre min-h olduğu için taşan içerik hücreyi büyütür,
          kırpılma olmaz. */}
      {overflowCount > 0 && (
        <span className="mt-4 text-[10px] text-gray-500">+{overflowCount} daha</span>
      )}
    </>
  );

  // Çerçeve rengi tek başına anlam taşımasın diye (renk körlüğü, spec §7.6)
  // kategori adı en azından `title` ile (fare üstüne gelince) erişilebilir —
  // görsel kalabalık yaratmadan.
  const academicTitleParts = [
    academicEdge?.start && `Başlangıç: ${getEventStyle(academicEdge.start).label}`,
    academicEdge?.end && `Bitiş: ${getEventStyle(academicEdge.end).label}`,
  ].filter(Boolean);
  const academicTitle = academicTitleParts.length > 0 ? academicTitleParts.join(" · ") : undefined;

  if (href) {
    return (
      <Link href={href} scroll={false} className={className} data-day-index={dayIndex} title={academicTitle}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} data-day-index={dayIndex} title={academicTitle}>
      {content}
    </div>
  );
}
