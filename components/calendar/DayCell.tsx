import Link from "next/link";
import type { CSSProperties } from "react";
import { formatDayNumber, isSameDay, isSameMonth, isWeekend } from "@/lib/calendar/date-utils";
import {
  getEventStyle,
  blendAcademicColors,
  academicSolidRgb,
  academicCategoryLabel,
  type EventKind,
} from "@/lib/calendar/color-system";
import type { AcademicDayEntry } from "@/lib/calendar/month-events";

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
   * Bu günü kapsayan akademik takvim kayıtları — hücre fon rengi bu listeye
   * göre (kategori bazlı) hesaplanır, birden fazla kayıt çakışıyorsa renkler
   * harmanlanır ve alt kenarda ayrı segmentler gösterilir (kullanıcı isteği,
   * 2026-09-10 — eski "sadece başlangıç/bitiş kenar çerçevesi" tasarımının
   * yerine).
   */
  academicDayEntries?: AcademicDayEntry[];
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
  /**
   * Kompakt mini-ay modu (Dönem görünümü, kullanıcı isteği 2026-09-10) —
   * küçültülmüş hücre boyutu, "+N daha" metni gizli. Akademik fon/segment,
   * not üçgeni, dominant-tür glyph'i KALIR (sadece küçültülür).
   */
  compact?: boolean;
};

export function DayCell({
  day,
  monthAnchor,
  today,
  dominantKind,
  overflowCount,
  hasNote,
  academicDayEntries,
  heatmapOn,
  href,
  selected,
  dayIndex,
  compact,
}: DayCellProps) {
  const inCurrentMonth = isSameMonth(day, monthAnchor);
  const isToday = isSameDay(day, today);
  const weekend = isWeekend(day);
  const dominantStyle = dominantKind ? getEventStyle(dominantKind) : null;
  const backgroundTint = heatmapOn
    ? dominantStyle?.heatmapBackgroundClassName
    : dominantStyle?.cellBackgroundClassName;

  const academicCategories = (academicDayEntries ?? []).map((e) => e.category);
  const uniqueAcademicCategories = [...new Set(academicCategories)];
  const academicColors = blendAcademicColors(academicCategories);
  const hasAcademic = academicColors !== undefined && inCurrentMonth;

  // Akademik fon bir alt katman (aşağıda ayrı <span>) olarak eklendiği için
  // ana hücrenin OPAK zemin sınıfını bırakmıyoruz — aksi halde alttaki
  // katmanı tamamen kapatır. Akademik yoksa eski opak zemin davranışı aynen
  // korunuyor.
  const baseBg = inCurrentMonth
    ? hasAcademic
      ? ""
      : "bg-white dark:bg-gray-950"
    : "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600";

  const className = [
    "group relative flex flex-col gap-1 border border-gray-200 dark:border-gray-800",
    compact ? "min-h-9 p-0.5" : "min-h-24 p-1.5",
    baseBg,
    weekend && inCurrentMonth ? "bg-gray-50/70 dark:bg-gray-900/40" : "",
    inCurrentMonth && backgroundTint ? backgroundTint : "",
    href ? "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-blue-400" : "",
    selected ? "ring-2 ring-inset ring-blue-600" : "",
  ].join(" ");

  const content = (
    <>
      {hasAcademic && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[var(--academic-bg-light)] dark:bg-[var(--academic-bg-dark)]"
          style={
            {
              "--academic-bg-light": academicColors!.light,
              "--academic-bg-dark": academicColors!.dark,
            } as CSSProperties
          }
        />
      )}
      {uniqueAcademicCategories.length >= 2 && (
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-1">
          {uniqueAcademicCategories.map((cat) => (
            <span key={cat} className="flex-1" style={{ backgroundColor: academicSolidRgb(cat) }} />
          ))}
        </span>
      )}
      {/* Renkli, satır satır açıklama kartı — fare hücrenin üzerine gelince
          görünür (kullanıcı raporu, 2026-09-10: tek satırlık "·" ile ayrılmış
          native tooltip metni karmaşık geliyordu). Sadece tam boy hücrelerde
          (kompakt modda değil — orada güne tıklamak zaten tam ayrıntıyı açıyor).
          `title` attribute'u (aşağıda) klavye/dokunmatik erişim için AYRICA
          duruyor, bu kart onun yerine değil, YANINDA. */}
      {!compact && (academicDayEntries?.length ?? 0) > 0 && (
        <div
          aria-hidden
          className="invisible absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-left text-xs text-gray-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <ul className="space-y-3">
            {academicDayEntries!.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: academicSolidRgb(e.category) }}
                />
                <span>
                  <span className="font-semibold">{academicCategoryLabel(e.category)}</span>
                  {": "}
                  {e.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasNote && (
        <span
          title="Bu güne not eklendi"
          aria-label="Bu güne not eklendi"
          className={[
            "absolute right-0 top-0 h-0 w-0 border-t-yellow-400 border-l-transparent dark:border-t-yellow-500",
            compact ? "border-t-[7px] border-l-[7px]" : "border-t-[11px] border-l-[11px]",
          ].join(" ")}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className={[
            "self-start rounded-full px-1.5",
            compact ? "text-[10px]" : "text-sm",
            isToday ? "bg-blue-600 font-semibold text-white" : "",
          ].join(" ")}
        >
          {formatDayNumber(day)}
        </span>
        {dominantStyle && (
          <span className={compact ? "text-[8px] text-gray-500" : "text-[10px] text-gray-500"} title={dominantStyle.label}>
            {dominantStyle.icon}
          </span>
        )}
      </div>
      <div className="mt-auto" />
      {/* Ders/etkinlik şeritleri (MonthGrid'de absolute konumlanmış, top-6'dan başlayıp
          en fazla 3 satır) ile üst üste binmesin diye (kullanıcı raporu, 2026-09-07)
          fazladan üst boşluk — hücre min-h olduğu için taşan içerik hücreyi büyütür,
          kırpılma olmaz. Kompakt modda bar şeritleri hiç render edilmediği için bu
          boşluğa ve taşma etiketine gerek yok. */}
      {!compact && overflowCount > 0 && (
        <span className="mt-4 text-[10px] text-gray-500">+{overflowCount} daha</span>
      )}
    </>
  );

  // Tam boy hücrelerde renkli kart (yukarıda) fareyle açıklamayı gösteriyor —
  // aynı bilgiyi native `title` ile de vermek iki ayrı tooltip'in üst üste
  // açılmasına (asıl şikayet, 2026-09-10) yol açardı, o yüzden `title` SADECE
  // kart olmayan kompakt modda (Dönem görünümü mini-ayları) devrede; orada
  // klavye/dokunmatik erişim ve renk körlüğü (spec §7.6) için tek kaynak bu.
  const academicTitleParts = (academicDayEntries ?? []).map(
    (e) => `${academicCategoryLabel(e.category)}: ${e.description}`
  );
  const academicTitle =
    compact && academicTitleParts.length > 0 ? academicTitleParts.join("\n") : undefined;

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
