"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const CATEGORY_LABELS: Record<string, string> = {
  SINAV: "Sınav",
  TATIL: "Tatil",
  DERS_DONEMI: "Ders dönemi",
  KAYIT: "Kayıt",
  IDARI: "İdari",
};

type CategoryOverrideSelectProps = {
  entryId: string;
  currentCategory: string;
  currentOverride: string | null;
  canEdit: boolean;
};

/**
 * Spec §4.1 "elle değiştirilebilmeli" gereksinimini sağ-tık menüsü yerine
 * satır içi bir seçim kutusuyla karşılıyoruz — aynı işlevi, özel bir
 * context-menu bileşeni kurmadan sağlıyor.
 */
export function CategoryOverrideSelect({
  entryId,
  currentCategory,
  currentOverride,
  canEdit,
}: CategoryOverrideSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return null;
  }

  const effective = currentOverride ?? currentCategory;

  async function handleChange(value: string) {
    setError(null);
    const categoryOverride = value === currentCategory ? null : value;
    const response = await fetch(`/api/academic-calendar/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryOverride }),
    });
    if (!response.ok) {
      setError("Kaydedilemedi");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <select
        className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-900"
        value={effective}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {currentOverride && <span className="text-[10px] text-gray-500">(elle değiştirildi)</span>}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
