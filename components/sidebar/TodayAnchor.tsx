"use client";

import { useEffect, useRef } from "react";

/**
 * Bugüne en yakın kayda otomatik kaydırma için görünmez işaret (spec §6.4).
 */
export function TodayAnchor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center" });
  }, []);

  return <div ref={ref} aria-hidden className="absolute -top-2 h-0 w-0" />;
}
