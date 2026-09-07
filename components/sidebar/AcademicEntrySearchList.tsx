"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { TodayAnchor } from "./TodayAnchor";
import { CategoryOverrideSelect } from "./CategoryOverrideSelect";

type AcademicRow = {
  id: string;
  description: string;
  category: string;
  categoryOverride: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  SINAV: "Sınav",
  TATIL: "Tatil",
  DERS_DONEMI: "Ders dönemi",
  KAYIT: "Kayıt",
  IDARI: "İdari",
};

function formatEntryDate(start: Date | null, end: Date | null): string {
  const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return "(tarih yok)";
}

/**
 * Akademik Takvim panelinin arama kutusu + liste kısmı — kategori çipleri
 * (`children`, Server Component'ten geliyor) arama kutusunun altında render
 * edilir, aynen ExamSessionSearchList'teki gerekçeyle (bkz. orada).
 */
export function AcademicEntrySearchList({
  rows,
  closestId,
  canEdit,
  children,
}: {
  rows: AcademicRow[];
  closestId: string | null;
  canEdit: boolean;
  children?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const searchLower = search.trim().toLowerCase();

  const visibleRows = rows.filter((row) => row.description.toLowerCase().includes(searchLower));

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Akademik takvimde ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
      />
      {children}
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {visibleRows.map((row) => {
          const effective = row.categoryOverride ?? row.category;
          const monthAnchor = row.startDate ?? row.endDate;
          const monthParam = monthAnchor
            ? `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`
            : undefined;
          return (
            <li key={row.id} className="relative py-2">
              {row.id === closestId && <TodayAnchor />}
              <Link href={monthParam ? `/calendar?month=${monthParam}` : "#"} className="block hover:underline">
                <div className="text-xs text-gray-500">{formatEntryDate(row.startDate, row.endDate)}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[effective] ?? effective}
                  </span>
                  <span>{row.description}</span>
                </div>
              </Link>
              <CategoryOverrideSelect
                entryId={row.id}
                currentCategory={row.category}
                currentOverride={row.categoryOverride}
                canEdit={canEdit}
              />
            </li>
          );
        })}
        {visibleRows.length === 0 && <li className="py-4 text-center text-xs text-gray-400">Kayıt yok</li>}
      </ul>
    </div>
  );
}
