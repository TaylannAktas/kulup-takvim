"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "kulup-takvim:sidebar-width";
const DEFAULT_WIDTH = 320; // önceki sabit `lg:w-80` (20rem) ile aynı
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

/**
 * Sol panelin sağ kenarından fare ile sürüklenerek genişletilip
 * daraltılabilmesini sağlar. Genişlik `localStorage`'da tutulur (kullanıcı
 * isteği, 2026-09-13): sekme kapat/aç ya da sayfa yenilense de seçilen
 * genişlik kaybolmasın.
 *
 * İlk render sunucuyla eşleşsin diye `DEFAULT_WIDTH` ile başlar; kayıtlı
 * değer mount sonrası bir efektte uygulanır (bkz. Atılım AI panelindeki
 * aynı desen — senkron localStorage okuması hydration uyuşmazlığı yaratır).
 */
export function ResizableSidebar({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const draggingRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) setWidth(clampWidth(parsed));
    } catch {
      // localStorage kapalıysa genişlik sadece bu oturumda hatırlanır.
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      draggingRef.current = true;
      const startX = event.clientX;
      const startWidth = width;
      const previousUserSelect = document.body.style.userSelect;
      const previousCursor = document.body.style.cursor;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      function onMove(moveEvent: PointerEvent) {
        if (!draggingRef.current) return;
        setWidth(clampWidth(startWidth + (moveEvent.clientX - startX)));
      }
      function onUp() {
        draggingRef.current = false;
        document.body.style.userSelect = previousUserSelect;
        document.body.style.cursor = previousCursor;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setWidth((current) => {
          try {
            localStorage.setItem(STORAGE_KEY, String(current));
          } catch {
            // yazılamıyorsa sessizce oturuma özel kalır.
          }
          return current;
        });
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [width],
  );

  return (
    <aside
      className="no-print relative flex w-full shrink-0 flex-col overflow-hidden border-b border-gray-200 lg:w-[var(--sidebar-w)] lg:border-b-0 lg:border-r dark:border-gray-800"
      style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}
    >
      {children}
      <div
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Kenar çubuğu genişliğini ayarla"
        title="Sürükleyerek genişliği ayarla"
        className="absolute inset-y-0 right-0 hidden w-1.5 cursor-col-resize touch-none hover:bg-purple-300/60 lg:block"
      />
    </aside>
  );
}
