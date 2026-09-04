import Link from "next/link";
import { getEventStyle, type EventKind } from "@/lib/calendar/color-system";

export type TermHeatmapDay = {
  date: Date;
  dominantKind: EventKind | null;
  count: number;
};

type TermHeatmapProps = {
  days: TermHeatmapDay[];
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("tr-TR", { month: "short" });
}

/**
 * GitHub katkı grafiği tarzı: sütun = hafta, satır = haftanın günü (Pzt-Paz).
 * Spec §6.5 "Dönem" görünümü: "hangi haftalar boş" sorusuna tek bakışta cevap.
 * Renk tek başına anlam taşımasın diye her hücrenin title'ında tarih + tür +
 * sayı var (hover ile okunabilir); günün rengi haftalar arası karşılaştırmayı
 * zaten görsel olarak taşıyor, metin etiketi bu ölçekte sığmıyor.
 */
export function TermHeatmap({ days }: TermHeatmapProps) {
  if (days.length === 0) {
    return <p className="p-4 text-center text-sm text-gray-400">Bu aralıkta gün yok.</p>;
  }

  // Pazartesi=0 ... Pazar=6 satır indeksine göre haftalara böl.
  const firstDay = days[0].date;
  const leadingEmpty = (firstDay.getDay() + 6) % 7; // Pzt->0 ... Paz->6

  const cells: Array<TermHeatmapDay | null> = [
    ...Array(leadingEmpty).fill(null),
    ...days,
  ];
  const weekCount = Math.ceil(cells.length / 7);

  const weeks: Array<Array<TermHeatmapDay | null>> = [];
  for (let w = 0; w < weekCount; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  // Her haftanın ilk gününe göre ay etiketi — ay değiştiğinde göster.
  let lastMonth = -1;
  const monthLabels = weeks.map((week) => {
    const firstReal = week.find((d) => d !== null);
    if (!firstReal) return "";
    const m = firstReal.date.getMonth();
    if (m === lastMonth) return "";
    lastMonth = m;
    return monthLabel(firstReal.date);
  });

  return (
    <div className="overflow-x-auto p-4">
      <div className="inline-grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "auto repeat(7, 14px)" }}>
        {weeks.map((_, weekIndex) => (
          <div key={`label-${weekIndex}`} className="text-[10px] text-gray-400" style={{ gridRow: 1, gridColumn: weekIndex + 1 }}>
            {monthLabels[weekIndex]}
          </div>
        ))}
        {weeks.map((week, weekIndex) =>
          week.map((day, rowIndex) => {
            const eventStyle = day?.dominantKind ? getEventStyle(day.dominantKind) : null;
            if (!day) {
              return (
                <div
                  key={`${weekIndex}-${rowIndex}`}
                  style={{ gridRow: rowIndex + 2, gridColumn: weekIndex + 1 }}
                />
              );
            }
            const key = dateKey(day.date);
            const monthParam = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}`;
            return (
              <Link
                key={`${weekIndex}-${rowIndex}`}
                href={`/calendar?month=${monthParam}&day=${key}`}
                title={`${day.date.toLocaleDateString("tr-TR")} — ${
                  eventStyle ? eventStyle.label : "boş"
                }${day.count > 0 ? ` (${day.count})` : ""}`}
                className={[
                  "block h-[14px] w-[14px] rounded-[2px]",
                  eventStyle ? eventStyle.barClassName : "bg-gray-100 dark:bg-gray-800",
                ].join(" ")}
                style={{ gridRow: rowIndex + 2, gridColumn: weekIndex + 1 }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
