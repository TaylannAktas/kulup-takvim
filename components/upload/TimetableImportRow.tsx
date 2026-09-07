"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TimetableImportRowProps = {
  id: string;
  sourceLabel: string | null;
  termCode: string | null;
  uploadedAt: Date;
  parsedSessionCount: number | null;
  isStale: boolean;
};

/**
 * `/admin/timetable-imports` tablosundaki bir satır — kullanıcı isteği
 * üzerine eklendi (2026-09-07): kaynak etiketi ve dönem kodu sonradan
 * düzenlenebilsin, kayıt silinebilsin. `PATCH`/`DELETE /api/timetable-imports/[id]`
 * kullanır; ders oturumlarına dokunmaz (silme, oturumları da kademeli siler —
 * bkz. route handler).
 */
export function TimetableImportRow({
  id,
  sourceLabel,
  termCode,
  uploadedAt,
  parsedSessionCount,
  isStale,
}: TimetableImportRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(sourceLabel ?? "");
  const [termDraft, setTermDraft] = useState(termCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/timetable-imports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: labelDraft.trim() || undefined,
          termCode: termDraft.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Kaydedilemedi.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${sourceLabel || "(adsız)"}" içe aktarmasını ve ona bağlı tüm ders oturumlarını silmek istediğine emin misin? Bu geri alınamaz.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/timetable-imports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Silinemedi.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-100 dark:border-gray-900">
        <td className="py-2 pr-3" colSpan={2}>
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Kaynak etiketi"
              disabled={saving}
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <input
              type="text"
              value={termDraft}
              onChange={(e) => setTermDraft(e.target.value)}
              placeholder="Dönem kodu"
              disabled={saving}
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </td>
        <td className="py-2 pr-3 text-xs text-gray-500">{uploadedAt.toLocaleString("tr-TR")}</td>
        <td className="py-2 pr-3">{parsedSessionCount ?? "—"}</td>
        <td className="py-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setLabelDraft(sourceLabel ?? "");
                setTermDraft(termCode ?? "");
                setError(null);
              }}
              disabled={saving}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
            >
              Vazgeç
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-100 dark:border-gray-900">
      <td className="py-2 pr-3">{sourceLabel || "—"}</td>
      <td className="py-2 pr-3">{termCode || "—"}</td>
      <td
        className={`py-2 pr-3 text-xs ${stale(isStale)}`}
      >
        {uploadedAt.toLocaleString("tr-TR")}
        {isStale && (
          <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            30+ gün
          </span>
        )}
      </td>
      <td className="py-2 pr-3">{parsedSessionCount ?? "—"}</td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={saving}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Düzenle
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Sil
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
    </tr>
  );
}

function stale(isStale: boolean): string {
  return isStale ? "text-amber-600 dark:text-amber-400" : "text-gray-600";
}
