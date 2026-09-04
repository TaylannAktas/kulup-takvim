"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Client-side wrapper that adds keyboard arrow-key navigation to the month grid.
 * Allows focusing and navigating between day cells using arrow keys.
 * (Spec §7.6 — Keyboard navigation in month grid)
 */
export function KeyboardGridNav({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        return;
      }

      const focused = document.activeElement;
      if (!focused) return;

      // Find the day cell (either the focused element itself or its nearest parent with data-day-index)
      let currentCell: Element | null = focused as Element;
      if (!currentCell.hasAttribute("data-day-index")) {
        currentCell = currentCell.closest("[data-day-index]");
      }
      if (!currentCell) return;

      const currentIndex = parseInt(currentCell.getAttribute("data-day-index") || "0", 10);

      let nextIndex = currentIndex;
      switch (e.key) {
        case "ArrowRight":
          nextIndex = currentIndex + 1;
          break;
        case "ArrowLeft":
          nextIndex = currentIndex - 1;
          break;
        case "ArrowDown":
          nextIndex = currentIndex + 7; // One week down
          break;
        case "ArrowUp":
          nextIndex = currentIndex - 7; // One week up
          break;
      }

      const nextCell = container.querySelector(`[data-day-index="${nextIndex}"]`) as HTMLElement | null;

      if (nextCell) {
        e.preventDefault();
        // Focus the link inside the cell, or the cell itself
        const link = nextCell.querySelector("a") as HTMLElement | null;
        (link || nextCell).focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <div ref={containerRef}>{children}</div>;
}
