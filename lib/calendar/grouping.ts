import type { TimelineItem } from "@/components/calendar/HourlyTimeline";

/**
 * Takvim sadeleştirmesi (kullanıcı isteği, 2026-09-17): aynı dersin aynı
 * saatteki farklı şubeleri/salonları ayrı ayrı çizilince takvim okunmaz hâle
 * geliyordu (ör. ENG101'in tek bir sınavı 32 satır). Veri modeli
 * değişmiyor — gruplama sadece gösterim anında yapılıyor. `server-only`
 * değil ki istemci bileşenleri de kullanabilsin.
 */

export type SessionLike = {
  id: string;
  courseCode: string | null;
  section: string | null;
  room: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type GroupedSession<T extends SessionLike> = {
  key: string;
  courseCode: string | null;
  startTime: string | null;
  endTime: string | null;
  sections: string[];
  rooms: string[];
  rows: T[];
};

function uniqueSorted(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b, "tr", { numeric: true })
  );
}

/**
 * Satırları ders kodu + başlangıç + bitiş saatine göre toplar. Gün/tarih ve
 * sınav türü gibi ek ayrımlar `extraKey` ile verilir (ders için hafta günü,
 * sınav için tarih + tür). Sıra: başlangıç saati, sonra ders kodu.
 */
export function groupSessions<T extends SessionLike>(rows: T[], extraKey: (row: T) => string = () => ""): GroupedSession<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = [extraKey(row), row.courseCode ?? "?", row.startTime ?? "", row.endTime ?? ""].join("|");
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => ({
      key,
      courseCode: groupRows[0].courseCode,
      startTime: groupRows[0].startTime,
      endTime: groupRows[0].endTime,
      sections: uniqueSorted(groupRows.map((r) => r.section)),
      rooms: uniqueSorted(groupRows.map((r) => r.room)),
      rows: groupRows,
    }))
    .sort(
      (a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? "") || (a.courseCode ?? "").localeCompare(b.courseCode ?? "")
    );
}

/** `"09:30:00"` → `"9.30"` — HourlyTimeline'daki saat biçimiyle aynı. */
export function formatShortTime(time: string | null): string {
  if (!time) return "?";
  const [h, m] = time.split(":");
  return `${Number(h)}.${m}`;
}

/** Hover metni için şube/derslik dökümü: `"Şb 05 · Müh. 1003 H"` satırları. */
export function describeGroupRows(group: GroupedSession<SessionLike>): string {
  return group.rows
    .map((row) => [row.section ? `Şb ${row.section}` : null, row.room].filter(Boolean).join(" · ") || "—")
    .join("\n");
}

/** Gün ayrıntısındaki satır etiketi: tek satırsa derslik, birden fazlaysa şube sayısı. */
export function groupTimelineLabel(group: GroupedSession<SessionLike>, unit: "şube" | "salon"): string {
  const code = group.courseCode ?? "?";
  if (group.rows.length === 1) return group.rooms[0] ? `${code} · ${group.rooms[0]}` : code;
  const count = unit === "şube" && group.sections.length > 1 ? group.sections.length : group.rows.length;
  return `${code} · ${count} ${unit}`;
}

/** Ay hücresindeki özet çubuğun etiketi — tek grupsa kodu, fazlaysa sayıyı gösterir. */
export function summaryBarLabel(
  groups: GroupedSession<SessionLike>[],
  noun: string,
  options: { prefix?: string; withTime?: boolean } = {}
): string {
  if (groups.length === 1) {
    const g = groups[0];
    return `${g.courseCode ?? "?"}${options.withTime && g.startTime ? ` ${formatShortTime(g.startTime)}` : ""}`;
  }
  const starts = groups.map((g) => g.startTime).filter((t): t is string => !!t).sort();
  const ends = groups.map((g) => g.endTime).filter((t): t is string => !!t).sort();
  const range = starts.length > 0 && ends.length > 0 ? ` · ${formatShortTime(starts[0])}–${formatShortTime(ends[ends.length - 1])}` : "";
  return `${options.prefix ? `${options.prefix} · ` : ""}${groups.length} ${noun}${range}`;
}

/** Hover metni: grupların kod + saat listesi, uzunsa kırpılmış. */
export function summaryBarDetail(groups: GroupedSession<SessionLike>[], limit = 15): string {
  const lines = groups.slice(0, limit).map((g) => `${formatShortTime(g.startTime)} ${g.courseCode ?? "?"}`);
  if (groups.length > limit) lines.push(`… +${groups.length - limit} daha`);
  return lines.join("\n");
}

export type TimelineGroup = NonNullable<TimelineItem["group"]>;

/**
 * Gün ayrıntısında kapatılmış bir türün öğelerini, zaman olarak çakışan ya da
 * birbirine değen kümeler hâlinde tek satıra indirir: "42 sınav" gibi. Böylece
 * tür kapalıyken de o saatlerin dolu olduğu görünmeye devam ediyor.
 */
export function collapseTimelineItems(items: TimelineItem[], group: TimelineGroup, noun: string): TimelineItem[] {
  const target = items.filter((i) => i.group === group).sort((a, b) => a.startMinutes - b.startMinutes);
  const rest = items.filter((i) => i.group !== group);
  const clusters: TimelineItem[][] = [];
  let clusterEnd = -1;
  for (const item of target) {
    if (clusters.length > 0 && item.startMinutes <= clusterEnd) {
      clusters[clusters.length - 1].push(item);
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
    } else {
      clusters.push([item]);
      clusterEnd = item.endMinutes;
    }
  }
  const merged = clusters.map((cluster, i) => ({
    id: `collapsed:${group}:${i}`,
    label: cluster.length === 1 ? cluster[0].label : `${cluster.length} ${noun}`,
    kind: cluster[0].kind,
    group,
    startMinutes: cluster[0].startMinutes,
    endMinutes: Math.max(...cluster.map((c) => c.endMinutes)),
    detail: cluster.map((c) => c.label).join("\n"),
  }));
  return [...rest, ...merged];
}
