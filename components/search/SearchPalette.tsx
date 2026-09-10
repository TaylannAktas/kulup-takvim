"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchResultItem } from "@/app/api/search/route";

const TYPE_LABELS: Record<SearchResultItem["type"], string> = {
  event: "Etkinlik",
  exam: "Sınav",
  academic: "Akademik Takvim",
};

/**
 * Cmd/Ctrl+K arama paleti (spec §7.1). Global olarak bir kez render edilir
 * (bkz. app/layout.tsx) ve klavye kısayoluyla açılır.
 */
export function SearchPalette() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Açılış anındaki state sıfırlama, ayrı bir effect'te `open`
        // değişimini izlemek yerine (react-hooks/set-state-in-effect) doğrudan
        // tek açılış noktasında yapılıyor — bu tuş kısayolu `open`'ı true
        // yapan TEK yer.
        setOpen((prevOpen) => {
          const next = !prevOpen;
          if (next) {
            setQuery("");
            setResults([]);
            setActiveIndex(0);
          }
          return next;
        });
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Saf bir DOM yan etkisi (odaklanma) — setState çağırmıyor, bu yüzden
  // yukarıdaki gibi bir sorun teşkil etmiyor.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    // Sorgu 2 karakterden kısaysa hiçbir şey (setState dahil) yapmadan çık —
    // render tarafı `visibleResults` ile zaten bunu ayrıca kontrol ediyor,
    // burada `results`'ı temizlemeye gerek yok.
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setActiveIndex(0);
        }
      } catch {
        // AbortError beklenen bir durum (yazarken önceki istek iptal edilir), yok say.
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  // Sorgu 2 karakterden kısayken `results`'taki eski veriyi göstermemek için
  // render'a giden liste burada süzülüyor (bkz. yukarıdaki effect yorumu).
  const visibleResults = query.trim().length >= 2 ? results : [];

  function goToResult(result: SearchResultItem) {
    setOpen(false);
    // Aktif katman/filtre seçimini (ör. seçili sınıf) korumak için mevcut
    // URL'in `layers` param'ı da taşınıyor (kullanıcı raporu, 2026-09-10 —
    // aynı sorun ViewSwitcher'da da vardı, orada da düzeltildi).
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", result.month);
    params.set("day", result.day);
    router.push(`/calendar?${params.toString()}`);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibleResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visibleResults[activeIndex]) {
      goToResult(visibleResults[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ders kodu, sınav, etkinlik, akademik takvim ara..."
          className="w-full border-b border-gray-200 px-4 py-3 text-sm outline-none dark:border-gray-800 dark:bg-gray-900"
        />
        <ul className="max-h-80 overflow-y-auto">
          {visibleResults.map((result, index) => (
            <li key={`${result.type}-${result.id}`}>
              <button
                type="button"
                onClick={() => goToResult(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={[
                  "flex w-full items-center justify-between px-4 py-2 text-left text-sm",
                  index === activeIndex ? "bg-gray-100 dark:bg-gray-800" : "",
                ].join(" ")}
              >
                <span>{result.label}</span>
                <span className="text-xs text-gray-400">{TYPE_LABELS[result.type]}</span>
              </button>
            </li>
          ))}
          {query.trim().length >= 2 && visibleResults.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-gray-400">Sonuç yok</li>
          )}
          {query.trim().length < 2 && (
            <li className="px-4 py-6 text-center text-xs text-gray-400">
              Aramak için en az 2 karakter yazın
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
