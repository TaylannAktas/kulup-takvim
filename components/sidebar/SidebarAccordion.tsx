"use client";

import { useState, type ReactNode } from "react";

type SidebarAccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Başlık satırının solunda, katla/aç düğmesinin dışında ayrı bir kontrol (ör. görünürlük tik kutusu). */
  headerControl?: ReactNode;
};

/**
 * Tek tek katlanabilir sol panel bölümü (spec §6.1). Açık olan bölüm kalan
 * yüksekliği kullanır (flex-1); kapalı bölümler sadece başlık yüksekliğinde kalır.
 *
 * `headerControl`, katla/aç `<button>`'ının DIŞINDA, ayrı bir kardeş öğe —
 * içine konan bir checkbox'a tıklamak accordion'u açıp kapatmasın diye
 * (checkbox zaten kendi `onClick`'inde `stopPropagation` çağırıyor ama iki
 * kat güvenlik: buton sınırının dışında olması event bubbling'i baştan
 * engelliyor).
 */
export function SidebarAccordion({ title, defaultOpen = false, children, headerControl }: SidebarAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`flex min-h-0 flex-col border-b border-gray-200 dark:border-gray-800 ${open ? "flex-1" : ""}`}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900">
        {headerControl}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
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
