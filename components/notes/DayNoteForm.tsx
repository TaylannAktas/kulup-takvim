"use client";

import { useState } from "react";

type DayNoteFormProps = {
  initialValue?: string;
  onSubmit: (body: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  submitLabel: string;
  showDelete?: boolean;
  onDelete?: () => void;
};

export function DayNoteForm({
  initialValue,
  onSubmit,
  submitLabel,
  showDelete,
  onDelete,
}: DayNoteFormProps) {
  const [body, setBody] = useState(initialValue ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await onSubmit(body);

      if (!result.ok) {
        setSubmitError(result.error);
      }
    } catch (err) {
      setSubmitError((err as Error).message || "Bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm("Notu silmek istediğinize emin misiniz?")) return;
    setIsSubmitting(true);
    try {
      await onDelete();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {submitError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Not
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          rows={6}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitLabel}
        </button>
        {showDelete && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400"
          >
            Sil
          </button>
        )}
      </div>
    </form>
  );
}
