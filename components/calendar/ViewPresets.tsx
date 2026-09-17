"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { parseLayers, withLayers } from "@/lib/calendar/layers";
import { CATEGORY_NAMESPACE, categoryHiddenLayerId, type CategoryKey } from "@/lib/calendar/category-layers";

/**
 * Tek tıkla odak görünümleri (kullanıcı isteği, 2026-09-17). Yeni bir durum
 * tutmuyor — sadece sol paneldeki ana tik kutularının kullandığı
 * `category-hidden:*` katmanlarını topluca ayarlıyor; sınıf/fakülte gibi
 * diğer seçimler olduğu gibi kalıyor. Akademik takvim her görünümde açık
 * (tatil/sınav haftası bağlamı hep lazım).
 */
const PRESETS: Array<{ label: string; hidden: CategoryKey[]; hint: string }> = [
  { label: "Tümü", hidden: [], hint: "Her şey görünür" },
  { label: "Etkinlik odaklı", hidden: ["course", "exam"], hint: "Sadece kulüp etkinlikleri + akademik takvim" },
  { label: "Sınavlar", hidden: ["course"], hint: "Sınav programı + etkinlikler, dersler gizli" },
  { label: "Dersler", hidden: ["exam"], hint: "Seçili ders programı + etkinlikler, sınavlar gizli" },
];

export function ViewPresets() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const layers = parseLayers(searchParams);
  const currentHidden = [...layers].filter((id) => id.startsWith(`${CATEGORY_NAMESPACE}:`)).sort();

  function apply(hidden: CategoryKey[]) {
    const next = new Set([...layers].filter((id) => !id.startsWith(`${CATEGORY_NAMESPACE}:`)));
    for (const category of hidden) next.add(categoryHiddenLayerId(category));
    const params = withLayers(new URLSearchParams(searchParams.toString()), next);
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Hazır görünümler">
      {PRESETS.map((preset) => {
        const active =
          JSON.stringify(preset.hidden.map(categoryHiddenLayerId).sort()) === JSON.stringify(currentHidden);
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => apply(preset.hidden)}
            aria-pressed={active}
            title={preset.hint}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
              active
                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
