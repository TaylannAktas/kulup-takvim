"use client";

import { getEventStyle, EventKind } from "@/lib/calendar/color-system";

export type TimelineItem = {
  id: string;
  label: string;
  kind: EventKind;
  startMinutes: number;
  endMinutes: number;
};

type HourlyTimelineProps = {
  items: TimelineItem[];
  startHour?: number;
  endHour?: number;
};

/**
 * Assigns items to columns for overlap handling. Returns an array of
 * { item, column, columnCount } for each item, where column is 0-indexed
 * and columnCount is the total number of columns used by this item's
 * overlap *cluster* (a maximal run of mutually-touching items — not just
 * pairwise overlap — so every item in the cluster gets the same width).
 *
 * Algorithm: sort by startMinutes, sweep to split into clusters (a cluster
 * ends when an item starts at/after the max end time seen so far in the
 * current cluster), then within each cluster greedily assign the first
 * column whose previous occupant has already ended.
 */
export function assignColumnsForOverlap(
  items: TimelineItem[]
): Array<{
  item: TimelineItem;
  column: number;
  columnCount: number;
}> {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes);

  const result: Array<{ item: TimelineItem; column: number; columnCount: number }> = [];

  let clusterStart = 0;
  let clusterMaxEnd = sorted[0].endMinutes;

  const flushCluster = (fromIndex: number, toIndex: number) => {
    const columnEndTimes: number[] = [];
    const columnByIndex: number[] = [];

    for (let i = fromIndex; i <= toIndex; i++) {
      const item = sorted[i];
      let assignedColumn = columnEndTimes.findIndex((end) => end <= item.startMinutes);
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(item.endMinutes);
      } else {
        columnEndTimes[assignedColumn] = item.endMinutes;
      }
      columnByIndex.push(assignedColumn);
    }

    const columnCount = columnEndTimes.length;
    for (let i = fromIndex; i <= toIndex; i++) {
      result.push({ item: sorted[i], column: columnByIndex[i - fromIndex], columnCount });
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinutes >= clusterMaxEnd) {
      flushCluster(clusterStart, i - 1);
      clusterStart = i;
      clusterMaxEnd = sorted[i].endMinutes;
    } else {
      clusterMaxEnd = Math.max(clusterMaxEnd, sorted[i].endMinutes);
    }
  }
  flushCluster(clusterStart, sorted.length - 1);

  return result;
}

/**
 * Clamps a time value to the visible range [startMinutes, endMinutes].
 */
function clampTime(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts minutes-since-midnight to pixels within a given time range.
 * Used for positioning and sizing timeline items.
 */
function minutesToPixels(
  minutes: number,
  startMinutes: number,
  endMinutes: number,
  containerHeightPx: number
): number {
  const totalMinutes = endMinutes - startMinutes;
  const offsetMinutes = minutes - startMinutes;
  return (offsetMinutes / totalMinutes) * containerHeightPx;
}

export function HourlyTimeline({
  items,
  startHour = 8,
  endHour = 22,
}: HourlyTimelineProps) {
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const totalMinutes = endMinutes - startMinutes;

  // Generate hour and half-hour gridline marks
  const gridLines: Array<{ minutes: number; isHour: boolean }> = [];
  for (let h = startHour; h <= endHour; h++) {
    gridLines.push({ minutes: h * 60, isHour: true });
    if (h < endHour) {
      gridLines.push({ minutes: h * 60 + 30, isHour: false });
    }
  }

  // Clip items to visible range
  const visibleItems = items
    .map((item) => ({
      ...item,
      startMinutes: clampTime(item.startMinutes, startMinutes, endMinutes),
      endMinutes: clampTime(item.endMinutes, startMinutes, endMinutes),
    }))
    .filter((item) => item.startMinutes < item.endMinutes); // Exclude fully-clipped items

  // Assign columns for overlap handling
  const itemsWithLayout = assignColumnsForOverlap(visibleItems);

  // Fixed height for the timeline container (to make pixel calculations stable)
  const containerHeightPx = Math.max(600, 40 * (endHour - startHour));

  return (
    <div className="flex h-full gap-0 overflow-hidden bg-white dark:bg-gray-950">
      {/* Left hour gutter */}
      <div className="w-16 shrink-0 border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative" style={{ height: `${containerHeightPx}px` }}>
          {/* Generate hour labels */}
          {Array.from({ length: endHour - startHour + 1 }).map((_, i) => {
            const hour = startHour + i;
            return (
              <div
                key={`hour-${hour}`}
                className="absolute left-0 right-0 text-center text-xs font-medium text-gray-600 dark:text-gray-400"
                style={{
                  top: `${minutesToPixels(hour * 60, startMinutes, endMinutes, containerHeightPx)}px`,
                  transform: "translateY(-0.5em)",
                }}
              >
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative flex-1 overflow-y-auto bg-white dark:bg-gray-950">
        <div style={{ height: `${containerHeightPx}px`, position: "relative" }}>
          {/* Gridlines (30-minute intervals) */}
          {gridLines.map(({ minutes, isHour }) => (
            <div
              key={`grid-${minutes}`}
              className={`absolute left-0 right-0 ${
                isHour
                  ? "border-t border-gray-300 dark:border-gray-700"
                  : "border-t border-gray-100 dark:border-gray-800"
              }`}
              style={{
                top: `${minutesToPixels(minutes, startMinutes, endMinutes, containerHeightPx)}px`,
              }}
            />
          ))}

          {/* Timeline items */}
          {itemsWithLayout.map(({ item, column, columnCount }) => {
            const topPx = minutesToPixels(
              item.startMinutes,
              startMinutes,
              endMinutes,
              containerHeightPx
            );
            const heightPx = minutesToPixels(
              item.endMinutes - item.startMinutes,
              0,
              totalMinutes,
              containerHeightPx
            );

            const style = getEventStyle(item.kind);
            const itemWidth = `calc((100% - 1px) / ${columnCount})`;
            const itemLeft = `calc(${column} * (100% / ${columnCount}))`;

            return (
              <div
                key={item.id}
                className={`absolute overflow-hidden rounded ${style.barClassName} flex flex-col justify-center gap-0.5 px-1.5 py-1 text-xs font-medium`}
                style={{
                  top: `${topPx}px`,
                  height: `${Math.max(heightPx, 20)}px`,
                  left: itemLeft,
                  width: itemWidth,
                  // Ensure minimum height for readability, but don't overflow container
                  minHeight: "20px",
                }}
                title={item.label}
              >
                {/* Icon + Label: always show both for accessibility (color-blind users, B&W printing) */}
                <div className="truncate text-center leading-tight">
                  <span className="mr-1">{style.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
