"use client";

import { useEffect, useState } from "react";
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

  function currentLayerValue(namespace: string): string | null {
    const layersParam = searchParams.get("layers");
    if (!layersParam) return null;
    const prefix = `${namespace}:`;
    const match = layersParam.split(",").find((l) => l.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
  }

  /** Yeni bir ders programı katmanı seçer — aynı anda en fazla bir tane aktif olabilir. */
  function selectCourseLayer(namespace: string, value: string) {
    const current = searchParams.get("layers");
    const others = (current ? current.split(",") : []).filter(
      (l) => !Object.values(COURSE_LAYER_NAMESPACE).some((ns) => l.startsWith(`${ns}:`))
    );
    const isAlreadySelected = currentLayerValue(namespace) === value;
    const next = isAlreadySelected ? others : [...others, `${namespace}:${value}`];

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
          {imports.map((imp) => {
            const active = currentLayerValue(COURSE_LAYER_NAMESPACE.import) === imp.id;
            return (
              <li key={imp.id}>
                <button
                  type="button"
                  onClick={() => selectCourseLayer(COURSE_LAYER_NAMESPACE.import, imp.id)}
                  className={[
                    "w-full py-1.5 text-left hover:underline",
                    active ? "font-semibold text-purple-700 dark:text-purple-400" : "",
                  ].join(" ")}
                >
                  {imp.sourceLabel ?? "(adsız)"}
                  <span className="ml-1 text-xs text-gray-400">
                    {imp.termCode ? `· ${imp.termCode}` : ""} · {imp.parsedSessionCount ?? 0} oturum
                  </span>
                </button>
              </li>
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
          <input
            type="text"
            placeholder="Derslik ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
          />
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {distinctRooms
              .filter((room) => room.toLowerCase().includes(searchLower))
              .map((room) => {
                const active = currentLayerValue(COURSE_LAYER_NAMESPACE.room) === room;
                return (
                  <li key={room}>
                    <button
                      type="button"
                      onClick={() => selectCourseLayer(COURSE_LAYER_NAMESPACE.room, room)}
                      className={[
                        "w-full py-1.5 text-left hover:underline",
                        active ? "font-semibold text-purple-700 dark:text-purple-400" : "",
                      ].join(" ")}
                    >
                      {room}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {tab === "dersler" && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Ders kodu/adı ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
          />
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {distinctCourses
              .filter(
                (c) =>
                  c.code.toLowerCase().includes(searchLower) ||
                  (c.name ?? "").toLowerCase().includes(searchLower)
              )
              .map((course) => {
                const active = currentLayerValue(COURSE_LAYER_NAMESPACE.course) === course.code;
                return (
                  <li key={course.code}>
                    <button
                      type="button"
                      onClick={() => selectCourseLayer(COURSE_LAYER_NAMESPACE.course, course.code)}
                      className={[
                        "w-full py-1.5 text-left hover:underline",
                        active ? "font-semibold text-purple-700 dark:text-purple-400" : "",
                      ].join(" ")}
                    >
                      {course.code}
                      {course.name && <span className="ml-1 text-xs text-gray-400">{course.name}</span>}
                    </button>
                  </li>
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
                .slice()
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
