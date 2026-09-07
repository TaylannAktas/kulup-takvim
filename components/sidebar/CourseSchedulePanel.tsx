"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COURSE_LAYER_NAMESPACE } from "@/lib/calendar/course-layers";

type TimetableImport = {
  id: string;
  sourceLabel: string | null;
  termCode: string | null;
  uploadedAt: string;
  parsedSessionCount: number | null;
};

type CourseSession = {
  id: string;
  courseCode: string | null;
  courseName: string | null;
  section: string | null;
  room: string | null;
  instructor: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  importId: string | null;
};

type Tab = "siniflar" | "derslikler" | "dersler" | "toplu";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "siniflar", label: "Sınıflar" },
  { key: "derslikler", label: "Derslikler" },
  { key: "dersler", label: "Dersler" },
  { key: "toplu", label: "Toplu Çizelge" },
];

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
};

/** İşaretli (takvimde görüntülenen) öğeleri üste, alfabetik sıralı sabitler. */
function sortPinnedFirst<T>(items: T[], label: (item: T) => string, selected: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => {
    const selectionDiff = Number(selected(b)) - Number(selected(a));
    if (selectionDiff !== 0) return selectionDiff;
    return label(a).localeCompare(label(b), "tr");
  });
}

/** Tik kutulu satır — Sınıflar/Derslikler/Dersler sekmelerinin üçünde de aynı desen. */
function CourseLayerCheckboxRow({
  active,
  onToggle,
  children,
}: {
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <label
        className={[
          "flex w-full cursor-pointer items-center gap-2 py-1.5",
          active ? "font-semibold text-purple-700 dark:text-purple-400" : "",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={onToggle}
          className="shrink-0 accent-purple-600"
        />
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </label>
    </li>
  );
}

/**
 * Spec §6.2: Sınıflar/Derslikler/Dersler/Toplu Çizelge sekmeleri.
 *
 * DECISIONS.md'de not edildiği gibi, edupage'den tek bir sınıf görünümü
 * içe aktarıldığında faculty_code/program_name/class_year çıkarılamıyor —
 * bu yüzden spec'in orijinal "Fakülte → Bölüm → Sınıf ağacı" tasarımı yerine
 * her içe aktarma (`timetable_imports`) bir "sınıf" olarak listeleniyor
 * (sourceLabel = kullanıcının yükleme sırasında verdiği ad, örn. "ACL 1").
 * Bu, veri modelinin gerçekten desteklediği en yakın karşılık.
 */
export function CourseSchedulePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("siniflar");
  const [imports, setImports] = useState<TimetableImport[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [importsRes, sessionsRes] = await Promise.all([
          fetch("/api/timetable-imports"),
          fetch("/api/course-sessions"),
        ]);
        const importsData = importsRes.ok ? await importsRes.json() : { imports: [] };
        const sessionsData = sessionsRes.ok ? await sessionsRes.json() : { sessions: [] };
        if (isMounted) {
          setImports(importsData.imports ?? []);
          setSessions(sessionsData.sessions ?? []);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  function isCourseLayerActive(namespace: string, value: string): boolean {
    const layersParam = searchParams.get("layers");
    if (!layersParam) return false;
    return layersParam.split(",").includes(`${namespace}:${value}`);
  }

  /**
   * Bir ders programı katmanını açar/kapatır. Diğer katmanlar gibi bağımsız
   * çoklu seçime izin verir — birden fazla sınıf/derslik/ders aynı anda
   * takvimde üst üste görüntülenebilir (bkz. DECISIONS.md 2026-09-06).
   */
  function toggleCourseLayer(namespace: string, value: string) {
    const id = `${namespace}:${value}`;
    const current = searchParams.get("layers");
    const layers = current ? current.split(",") : [];
    const next = layers.includes(id) ? layers.filter((l) => l !== id) : [...layers, id];

    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) params.set("layers", next.sort().join(","));
    else params.delete("layers");
    router.push(`/calendar?${params.toString()}`, { scroll: false });
  }

  const distinctRooms = [...new Set(sessions.map((s) => s.room).filter((r): r is string => !!r))].sort();
  const distinctCourses = [
    ...new Map(
      sessions
        .filter((s) => s.courseCode)
        .map((s) => [s.courseCode, { code: s.courseCode!, name: s.courseName }])
    ).values(),
  ].sort((a, b) => a.code.localeCompare(b.code));

  const searchLower = search.trim().toLowerCase();

  if (loading) {
    return <p className="py-4 text-center text-xs text-gray-400">Yükleniyor...</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input
        type="text"
        placeholder="Ders programında ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
      />
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              "rounded px-2 py-1 text-xs",
              tab === t.key
                ? "bg-purple-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "siniflar" && (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {sortPinnedFirst(
            imports.filter(
              (imp) =>
                (imp.sourceLabel ?? "").toLowerCase().includes(searchLower) ||
                (imp.termCode ?? "").toLowerCase().includes(searchLower)
            ),
            (imp) => imp.sourceLabel ?? "(adsız)",
            (imp) => isCourseLayerActive(COURSE_LAYER_NAMESPACE.import, imp.id)
          ).map((imp) => {
            const active = isCourseLayerActive(COURSE_LAYER_NAMESPACE.import, imp.id);
            return (
              <CourseLayerCheckboxRow
                key={imp.id}
                active={active}
                onToggle={() => toggleCourseLayer(COURSE_LAYER_NAMESPACE.import, imp.id)}
              >
                {imp.sourceLabel ?? "(adsız)"}
                <span className="ml-1 text-xs text-gray-400">
                  {imp.termCode ? `· ${imp.termCode}` : ""} · {imp.parsedSessionCount ?? 0} oturum
                </span>
              </CourseLayerCheckboxRow>
            );
          })}
          {imports.length === 0 && (
            <li className="py-4 text-center text-xs text-gray-400">
              Henüz içe aktarılmış ders programı yok.
            </li>
          )}
        </ul>
      )}

      {tab === "derslikler" && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {sortPinnedFirst(
              distinctRooms.filter((room) => room.toLowerCase().includes(searchLower)),
              (room) => room,
              (room) => isCourseLayerActive(COURSE_LAYER_NAMESPACE.room, room)
            ).map((room) => {
              const active = isCourseLayerActive(COURSE_LAYER_NAMESPACE.room, room);
              return (
                <CourseLayerCheckboxRow
                  key={room}
                  active={active}
                  onToggle={() => toggleCourseLayer(COURSE_LAYER_NAMESPACE.room, room)}
                >
                  {room}
                </CourseLayerCheckboxRow>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "dersler" && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {sortPinnedFirst(
              distinctCourses.filter(
                (c) =>
                  c.code.toLowerCase().includes(searchLower) ||
                  (c.name ?? "").toLowerCase().includes(searchLower)
              ),
              (c) => c.code,
              (c) => isCourseLayerActive(COURSE_LAYER_NAMESPACE.course, c.code)
            ).map((course) => {
              const active = isCourseLayerActive(COURSE_LAYER_NAMESPACE.course, course.code);
              return (
                <CourseLayerCheckboxRow
                  key={course.code}
                  active={active}
                  onToggle={() => toggleCourseLayer(COURSE_LAYER_NAMESPACE.course, course.code)}
                >
                  {course.code}
                  {course.name && <span className="ml-1 text-xs text-gray-400">{course.name}</span>}
                </CourseLayerCheckboxRow>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "toplu" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                <th className="py-1 pr-2">Gün</th>
                <th className="py-1 pr-2">Saat</th>
                <th className="py-1 pr-2">Ders</th>
                <th className="py-1">Derslik</th>
              </tr>
            </thead>
            <tbody>
              {sessions
                .filter(
                  (s) =>
                    (s.courseCode ?? "").toLowerCase().includes(searchLower) ||
                    (s.courseName ?? "").toLowerCase().includes(searchLower) ||
                    (s.room ?? "").toLowerCase().includes(searchLower)
                )
                .sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? ""))
                .map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-900">
                    <td className="py-1 pr-2">{s.weekday ? WEEKDAY_LABELS[s.weekday] : "—"}</td>
                    <td className="py-1 pr-2">
                      {s.startTime ?? "--:--"}–{s.endTime ?? "--:--"}
                    </td>
                    <td className="py-1 pr-2">{s.courseCode ?? "?"}</td>
                    <td className="py-1">{s.room ?? ""}</td>
                  </tr>
                ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    Ders oturumu yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <a href="/admin/timetable-imports" className="mt-2 text-xs text-gray-400 hover:underline">
        Ders programı içe aktar / yeniden içe aktar →
      </a>
    </div>
  );
}
