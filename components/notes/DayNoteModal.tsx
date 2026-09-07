"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayNoteForm } from "./DayNoteForm";

type DayNoteModalProps = {
  date: string; // ISO date (YYYY-MM-DD)
  canEdit: boolean;
};

export function DayNoteModal({ date, canEdit }: DayNoteModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [noteData, setNoteData] = useState<{ id: string; body: string } | null>(null);

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("newNote");
    router.push(`/calendar${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    router.refresh();
  }, [searchParams, router]);

  // Yüklemeye başla
  useEffect(() => {
    let isMounted = true;

    async function fetchNote() {
      try {
        const res = await fetch(`/api/day-notes?date=${date}`);
        if (!res.ok) throw new Error("Yüklenemiyor");
        const data = await res.json();
        if (isMounted) {
          // notes dizisi içinde en fazla 1 kayıt olabilir
          setNoteData(data.notes?.length > 0 ? data.notes[0] : null);
        }
      } catch (err) {
        console.error("Not yükleme hatası:", err);
        if (isMounted) {
          handleClose();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchNote();
    return () => {
      isMounted = false;
    };
  }, [date, handleClose]);

  async function handleSubmit(body: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      if (noteData) {
        // PATCH (edit)
        const res = await fetch(`/api/day-notes/${noteData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });

        if (!res.ok) {
          const data = await res.json();
          return { ok: false, error: data.error?.message || "Kaydedilemedi" };
        }
      } else {
        // POST (create)
        const res = await fetch("/api/day-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, body }),
        });

        if (!res.ok) {
          const data = await res.json();
          return { ok: false, error: data.error?.message || "Kaydedilemedi" };
        }
      }

      handleClose();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async function handleDelete() {
    if (!noteData) return;
    try {
      const res = await fetch(`/api/day-notes/${noteData.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      handleClose();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40">
        <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const submitLabel = noteData ? "Güncelle" : "Oluştur";
  const showDelete = canEdit && !!noteData;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {date.split("-").reverse().join(".")} - Not
          </h2>
          <button
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <DayNoteForm
            initialValue={noteData?.body}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
            showDelete={showDelete}
            onDelete={showDelete ? handleDelete : undefined}
          />
        </div>
      </div>
    </div>
  );
}
