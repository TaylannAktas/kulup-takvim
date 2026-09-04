"use client";

import { type ConflictFlags, hasAnyConflict } from "@/lib/calendar/conflict-types";

type ConflictBadgeProps = {
  flags: ConflictFlags;
};

export function ConflictBadge({ flags }: ConflictBadgeProps) {
  if (!hasAnyConflict(flags)) {
    return null;
  }

  const totalCount = flags.exam.length + flags.holiday.length + flags.event.length;

  return (
    <div className="space-y-2">
      <details className="space-y-2" open>
        <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">
          ⚠ {totalCount} çakışma
        </summary>
        <div className="space-y-3 pt-2">
          {flags.exam.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Sınav
              </h3>
              <ul className="space-y-1">
                {flags.exam.map((entry) => (
                  <li key={entry.id} className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flags.holiday.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Tatil
              </h3>
              <ul className="space-y-1">
                {flags.holiday.map((entry) => (
                  <li key={entry.id} className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flags.event.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Diğer Etkinlik
              </h3>
              <ul className="space-y-1">
                {flags.event.map((entry) => (
                  <li key={entry.id} className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
