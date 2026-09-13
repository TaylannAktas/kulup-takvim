"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "kulup-takvim:layers";

/**
 * Sol panelden seçilen filtreler `layers` query param'ında yaşar (bkz.
 * `lib/calendar/layers.ts`) — paylaşılabilir bağlantı için doğru ama sekmeyi
 * kapatıp yeniden açınca ya da doğrudan `/calendar`'a gelince kayboluyordu
 * (kullanıcı isteği, 2026-09-13). Bu bileşen köprü görevi görür:
 *
 * - Seçim URL'de VARSA localStorage'a yazılır (kullanıcı bilinçli olarak
 *   hepsini temizlerse bu da "boş" olarak yazılır — temizleme kararı da kalıcı).
 * - Sayfa `layers` YOKKEN açılırsa (taze sekme / doğrudan `/calendar`) ve bu
 *   mount'ta henüz denenmediyse, son kaydedilen seçim URL'e geri konur.
 *   Sadece mount başına bir kez dener; aynı oturumda kullanıcı filtreleri
 *   tekrar temizlerse üstüne yazıp durmaz.
 *
 * `useSearchParams` kullanan iç bileşen `Suspense` ile sarmalı — aksi halde
 * statik üretilen sayfaların build'i kırılıyor (bkz. `SearchPalette`, aynı
 * sebep, 2026-09-10).
 */
export function LayersPersistence() {
  return (
    <Suspense fallback={null}>
      <LayersPersistenceInner />
    </Suspense>
  );
}

function LayersPersistenceInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoreAttempted = useRef(false);

  useEffect(() => {
    const layersParam = searchParams.get("layers") ?? "";

    if (!restoreAttempted.current && !layersParam) {
      restoreAttempted.current = true;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch {
        saved = null;
      }
      if (saved) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("layers", saved);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }
    }
    restoreAttempted.current = true;

    try {
      if (layersParam) localStorage.setItem(STORAGE_KEY, layersParam);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // yazılamıyorsa filtreler sadece bu oturumda hatırlanır.
    }
  }, [searchParams, pathname, router]);

  return null;
}
