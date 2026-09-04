import Link from "next/link";

const VIEWS = [
  { key: "ay", label: "Ay", available: true, href: "/calendar" },
  { key: "hafta", label: "Hafta", available: false, href: "#" },
  { key: "gun", label: "Gün", available: false, href: "#" },
  { key: "donem", label: "Dönem", available: true, href: "/calendar/term" },
] as const;

/**
 * Ay/Hafta/Gün/Dönem görünüm anahtarı (spec §6.5). Hafta/Gün henüz yok
 * (devre dışı, "Yakında"); Ay ve Dönem Faz 5'te bağlandı.
 */
export function ViewSwitcher({ active = "ay" }: { active?: string }) {
  return (
    <div className="flex overflow-hidden rounded border border-gray-300 text-sm dark:border-gray-700">
      {VIEWS.map((view, i) => {
        const className = [
          "px-3 py-1",
          i > 0 ? "border-l border-gray-300 dark:border-gray-700" : "",
          view.key === active ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "",
          !view.available ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-800",
        ].join(" ");

        if (!view.available) {
          return (
            <button key={view.key} type="button" disabled title="Yakında" className={className}>
              {view.label}
            </button>
          );
        }

        return (
          <Link key={view.key} href={view.href} className={className}>
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
