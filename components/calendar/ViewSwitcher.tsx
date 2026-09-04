const VIEWS = [
  { key: "ay", label: "Ay", available: true },
  { key: "hafta", label: "Hafta", available: false },
  { key: "gun", label: "Gün", available: false },
  { key: "donem", label: "Dönem", available: false },
] as const;

/**
 * Ay/Hafta/Gün/Dönem görünüm anahtarı (spec §6.5). Şu an sadece Ay görünümü
 * var; diğerleri Faz 5'te eklenecek — o zamana kadar devre dışı gösteriliyor.
 */
export function ViewSwitcher({ active = "ay" }: { active?: string }) {
  return (
    <div className="flex overflow-hidden rounded border border-gray-300 text-sm dark:border-gray-700">
      {VIEWS.map((view, i) => (
        <button
          key={view.key}
          type="button"
          disabled={!view.available}
          title={view.available ? undefined : "Yakında"}
          className={[
            "px-3 py-1",
            i > 0 ? "border-l border-gray-300 dark:border-gray-700" : "",
            view.key === active ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "",
            !view.available ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-800",
          ].join(" ")}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
