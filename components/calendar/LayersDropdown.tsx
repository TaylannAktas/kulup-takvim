"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseLayers, toggleLayer, withLayers, HEATMAP_LAYER_ID } from "@/lib/calendar/layers";

type LayersDropdownProps = {
  activeLayers: Set<string>;
};

/**
 * Aktif katmanları listeler, "hepsini temizle" sunar (spec §6.6). Katman
 * kimliklerinin okunabilir etiketlere çevrilmesi ileride ilgili panel
 * eklendikçe genişletilecek; şimdilik ad alanı:değer olarak gösteriliyor.
 *
 * "Isı haritası" (2026-09-08) — eski Dönem sayfasındaki ısı haritasının
 * yerini alan, Ay görünümünde günleri baskın türe göre tonlayan katman.
 * Diğer katmanlardan farklı olarak burada AYRI, adlandırılmış bir tik
 * kutusu var (sadece "layers" listesinde bir kimlik olarak durmuyor, sık
 * kullanılacağı için tek tıkla erişilebilir).
 */
export function LayersDropdown({ activeLayers }: LayersDropdownProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const heatmapOn = activeLayers.has(HEATMAP_LAYER_ID);

  function clearAll() {
    const url = new URL(window.location.href);
    url.searchParams.delete("layers");
    router.push(url.pathname + url.search);
    setOpen(false);
  }

  function toggleHeatmap() {
    const params = withLayers(
      new URLSearchParams(searchParams.toString()),
      toggleLayer(parseLayers(searchParams), HEATMAP_LAYER_ID)
    );
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        Katmanlar ({activeLayers.size}) ▾
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 w-56 rounded border border-gray-200 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <label className="mb-2 flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="checkbox"
              checked={heatmapOn}
              onChange={toggleHeatmap}
              className="accent-purple-600"
            />
            <span>Isı haritası</span>
          </label>
          <div className="mb-2 border-t border-gray-100 dark:border-gray-800" />
          {activeLayers.size === 0 ? (
            <p className="text-xs text-gray-400">Aktif katman yok</p>
          ) : (
            <ul className="mb-2 flex flex-col gap-1">
              {[...activeLayers].map((id) => (
                <li key={id} className="truncate text-xs text-gray-600 dark:text-gray-300">
                  {id}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={clearAll}
            disabled={activeLayers.size === 0}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
          >
            Hepsini temizle
          </button>
        </div>
      )}
    </div>
  );
}
