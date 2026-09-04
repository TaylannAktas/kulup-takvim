import Link from "next/link";
import { ViewSwitcher } from "./ViewSwitcher";
import { LayersDropdown } from "./LayersDropdown";

type BottomToolbarProps = {
  activeLayers: Set<string>;
  hrefSuffix: string;
  canEdit: boolean;
};

/**
 * Spec §6.6 alt araç çubuğu. Etkinlik/not oluşturma (Faz 3) ve dışa aktarma
 * (Faz 5) henüz yok — o düğmeler bilinçli olarak devre dışı, "yakında" yazısıyla.
 */
export function BottomToolbar({ activeLayers, hrefSuffix, canEdit }: BottomToolbarProps) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 p-2 dark:border-gray-800">
      <ViewSwitcher />
      <div className="flex items-center gap-2">
        {canEdit ? (
          <>
            <Link
              href={`/calendar${hrefSuffix}${hrefSuffix ? "&" : "?"}newEvent=1`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              + Etkinlik
            </Link>
            <Link
              href={`/calendar${hrefSuffix}${hrefSuffix ? "&" : "?"}newNote=1`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              + Not
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-300 dark:border-gray-700 dark:text-gray-600"
            >
              + Etkinlik
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-300 dark:border-gray-700 dark:text-gray-600"
            >
              + Not
            </button>
          </>
        )}
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
