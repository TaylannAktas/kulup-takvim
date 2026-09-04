"use client";

import { useState, type ReactNode } from "react";

type SidebarAccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Tek tek katlanabilir sol panel bölümü (spec §6.1). Açık olan bölüm kalan
 * yüksekliği kullanır (flex-1); kapalı bölümler sadece başlık yüksekliğinde kalır.
 */
export function SidebarAccordion({ title, defaultOpen = false, children }: SidebarAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`flex min-h-0 flex-col border-b border-gray-200 dark:border-gray-800 ${open ? "flex-1" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center justify-between px-3 py-2 text-left text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span aria-hidden className="text-gray-400">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>}
    </div>
  );
}
