import { ViewSwitcher } from "./ViewSwitcher";
import { LayersDropdown } from "./LayersDropdown";

type BottomToolbarProps = {
  activeLayers: Set<string>;
};

/**
 * Spec §6.6 alt araç çubuğu. Etkinlik/not oluşturma (Faz 3) ve dışa aktarma
 * (Faz 5) henüz yok — o düğmeler bilinçli olarak devre dışı, "yakında" yazısıyla.
 */
export function BottomToolbar({ activeLayers }: BottomToolbarProps) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 p-2 dark:border-gray-800">
      <ViewSwitcher />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Yakında (Faz 3)"
          className="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-300 dark:border-gray-700 dark:text-gray-600"
        >
          + Etkinlik
        </button>
        <button
          type="button"
          disabled
          title="Yakında (Faz 3)"
          className="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-300 dark:border-gray-700 dark:text-gray-600"
        >
          + Not
        </button>
        <LayersDropdown activeLayers={activeLayers} />
        <button
          type="button"
          disabled
          title="Yakında (Faz 5)"
          className="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-300 dark:border-gray-700 dark:text-gray-600"
        >
          Dışa aktar ▾
        </button>
      </div>
    </div>
  );
}
