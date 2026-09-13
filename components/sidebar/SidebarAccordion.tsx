"use client";

import { useEffect, useState, type ReactNode } from "react";

type SidebarAccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Başlık satırının solunda, katla/aç düğmesinin dışında ayrı bir kontrol (ör. görünürlük tik kutusu). */
  headerControl?: ReactNode;
};

const STORAGE_KEY = "kulup-takvim:sidebar-open-panels";

function readStoredOpen(title: string): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed[title] === "boolean" ? parsed[title] : null;
  } catch {
    return null;
  }
}

function writeStoredOpen(title: string, open: boolean): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[title] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage kapalıysa panel durumu sadece bu oturumda hatırlanır.
  }
}

/**
 * Tek tek katlanabilir sol panel bölümü (spec §6.1). Açık olan bölüm kalan
 * yüksekliği kullanır (flex-1); kapalı bölümler sadece başlık yüksekliğinde kalır.
 *
 * `headerControl`, katla/aç `<button>`'ının DIŞINDA, ayrı bir kardeş öğe —
 * içine konan bir checkbox'a tıklamak accordion'u açıp kapatmasın diye
 * (checkbox zaten kendi `onClick`'inde `stopPropagation` çağırıyor ama iki
 * kat güvenlik: buton sınırının dışında olması event bubbling'i baştan
 * engelliyor).
 *
 * Açık/kapalı durumu `localStorage`'da tutulur (kullanıcı isteği, 2026-09-13)
 * — panel kapanınca `defaultOpen`'a sıfırlanmasın. İlk render sunucuyla
 * eşleşsin diye `defaultOpen` ile başlar, kayıtlı değer mount sonrası bir
 * efektte uygulanır.
 */
export function SidebarAccordion({ title, defaultOpen = false, children, headerControl }: SidebarAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = readStoredOpen(title);
    if (stored !== null) setOpen(stored);
  }, [title]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      writeStoredOpen(title, next);
      return next;
    });
  }

  return (
    <div className={`flex min-h-0 flex-col border-b border-gray-200 dark:border-gray-800 ${open ? "flex-1" : ""}`}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900">
        {headerControl}
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center justify-between text-left text-sm font-semibold"
          aria-expanded={open}
        >
          <span>{title}</span>
          <span aria-hidden className="text-gray-400">
            {open ? "▾" : "▸"}
          </span>
        </button>
      </div>
      {open && <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>}
    </div>
  );
}
