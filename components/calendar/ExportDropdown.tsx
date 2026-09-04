"use client";

import { useState } from "react";

/**
 * Export options dropdown (Spec §6.6). Provides calendar export (.ics) and
 * print/PDF export options. Mirrors LayersDropdown's pattern for consistency.
 */
export function ExportDropdown() {
  const [open, setOpen] = useState(false);

  function handlePrint() {
    window.print();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        Dışa aktar ▾
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 w-56 rounded border border-gray-200 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <ul className="flex flex-col gap-1">
            <li>
              <a
                href="/api/export/ics"
                download="kulup-takvimi.ics"
                className="block rounded px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setOpen(false)}
              >
                Takvimi dışa aktar (.ics)
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Bu ayı yazdır/PDF olarak kaydet
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
