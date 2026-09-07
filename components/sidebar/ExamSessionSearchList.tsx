"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type ExamRow = {
  id: string;
  examDate: Date | null;
  startTime: string | null;
  courseCode: string | null;
  room: string | null;
};

/**
 * Sınav Programı panelinin arama kutusu + gruplanmış liste kısmı — ayrı bir
 * client component olarak tutuluyor çünkü panelin geri kalanı (fakülte/tür
 * çipleri) bir Server Component (`ExamSchedulePanel`), ama serbest metin arama
 * yerel state gerektiriyor. Fakülte/tür filtresinden geçmiş satırlar
 * (`rows`) sunucudan olduğu gibi alınıyor, burada sadece kod/derslik metnine
 * göre ek bir süzme yapılıyor.
 *
 * `children` (fakülte/tür çipleri) arama kutusunun ALTINDA render ediliyor —
 * kullanıcı isteği "kategori başlığının hemen altına arama barı" arama
 * kutusunun panelin en üstünde olmasını gerektiriyor, ama çipler sunucu
 * tarafında render edildiği için JSX sırasını böyle kurmak gerekti.
 */
export function ExamSessionSearchList({ rows, children }: { rows: ExamRow[]; children?: ReactNode }) {
  const [search, setSearch] = useState("");
  const searchLower = search.trim().toLowerCase();

  const visibleRows = rows.filter(
    (row) =>
      (row.courseCode ?? "").toLowerCase().includes(searchLower) ||
      (row.room ?? "").toLowerCase().includes(searchLower)
  );

  const grouped = new Map<string, ExamRow[]>();
  for (const row of visibleRows) {
    const key = row.examDate ? row.examDate.toISOString().slice(0, 10) : "tarih-yok";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Ders kodu/derslik ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
      />
      {children}
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
        {visibleRows.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Kayıt yok</p>}
      </div>
    </div>
  );
}
