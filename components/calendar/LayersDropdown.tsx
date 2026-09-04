"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LayersDropdownProps = {
  activeLayers: Set<string>;
};

/**
 * Aktif katmanları listeler, "hepsini temizle" sunar (spec §6.6). Katman
 * kimliklerinin okunabilir etiketlere çevrilmesi ileride ilgili panel
 * eklendikçe genişletilecek; şimdilik ad alanı:değer olarak gösteriliyor.
 */
export function LayersDropdown({ activeLayers }: LayersDropdownProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function clearAll() {
    const url = new URL(window.location.href);
    url.searchParams.delete("layers");
    router.push(url.pathname + url.search);
    setOpen(false);
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
