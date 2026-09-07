"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { parseLayers, toggleLayer, withLayers } from "@/lib/calendar/layers";
import { categoryHiddenLayerId, type CategoryKey } from "@/lib/calendar/category-layers";

/**
 * SidebarAccordion başlığının yanına konan ana tik kutusu. Sınıflar
 * sekmesindeki checkbox'larla aynı toggle mantığı (bkz. CourseSchedulePanel),
 * ama tek bir bütün kategoriyi (ders programı/sınav programı/akademik takvim)
 * açıp kapatıyor — o kategorinin kendi alt filtreleri ne olursa olsun.
 */
export function CategoryVisibilityCheckbox({ category }: { category: CategoryKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = categoryHiddenLayerId(category);
  const layers = parseLayers(searchParams);
  const hidden = layers.has(id);

  function handleChange() {
    const params = withLayers(new URLSearchParams(searchParams.toString()), toggleLayer(layers, id));
    router.push(`/calendar?${params.toString()}`, { scroll: false });
  }

  return (
    <input
      type="checkbox"
      checked={!hidden}
      onClick={(e) => e.stopPropagation()}
      onChange={handleChange}
      className="shrink-0 accent-purple-600"
      aria-label="Bu kategoriyi takvimde göster/gizle"
    />
  );
}
