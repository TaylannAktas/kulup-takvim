import Link from "next/link";

/**
 * Sınıflar sekmesindeki tik kutulu satırlarla (bkz. CourseSchedulePanel'in
 * CourseLayerCheckboxRow'u) aynı görünüm — kullanıcı isteğiyle (2026-09-08)
 * Sınav Programı (fakülte/tür) ve Akademik Takvim (kategori) filtreleri de
 * eski "pill" (yuvarlak köşeli, yan yana dizilen) buton stilinden bu dikey,
 * tik kutulu satır stiline geçirildi.
 *
 * Sınıflar'daki gibi bir `onClick`/state değil, doğrudan `<Link>` — bu iki
 * panel zaten Server Component (sunucuda `href` üretiyor), istemci state'ine
 * geçirmeye gerek yok. Checkbox salt görsel (`readOnly`, `tabIndex={-1}`);
 * tıklamayı/klavye erişimini kapsayan `<Link>` üstleniyor.
 */
export function FilterCheckboxRow({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={[
        "flex items-center gap-2 rounded px-1 py-1 text-xs",
        active ? "font-semibold text-purple-700 dark:text-purple-400" : "text-gray-600 dark:text-gray-300",
        "hover:bg-gray-50 dark:hover:bg-gray-800",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={active}
        readOnly
        tabIndex={-1}
        className="pointer-events-none shrink-0 accent-purple-600"
      />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
