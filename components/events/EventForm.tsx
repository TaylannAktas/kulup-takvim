"use client";

import { useState } from "react";
import { fromClubTime, toClubTime } from "@/lib/calendar/date-utils";
import type { ConflictFlags } from "@/lib/calendar/conflict-types";

/** `POST/PATCH /api/events`'e giden gövde (bkz. EventModal.handleSubmit). */
export type EventFormValues = {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  status: string;
  location?: string;
  expectedAttendance?: number;
  colorOverride?: string;
};

/** API'den dönen (JSON üzerinden — Date alanları ISO string) bir etkinlik kaydı. */
export type ClubEventRecord = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  status: string;
  location: string | null;
  expectedAttendance: number | null;
  colorOverride: string | null;
  updatedAt: string;
  conflictFlags: ConflictFlags | null;
};

const STATUS_LABELS: Record<string, string> = {
  fikir: "Fikir",
  planlaniyor: "Planlanıyor",
  onaylandi: "Onaylandı",
  yapildi: "Yapıldı",
  iptal: "İptal",
};

type EventFormProps = {
  initialValues?: {
    title?: string;
    description?: string;
    startAt?: string; // ISO with offset
    endAt?: string; // ISO with offset
    isAllDay?: boolean;
    status?: string;
    location?: string;
    expectedAttendance?: number | null;
    colorOverride?: string | null;
  };
  onSubmit: (values: EventFormValues) => Promise<{ ok: true; event: ClubEventRecord } | { ok: false; error: string }>;
  submitLabel: string;
  showDelete?: boolean;
  onDelete?: () => void;
};

/**
 * İso string'i (offset ile) datetime-local input'ın value biçimine çevirir.
 * "2025-09-04T10:30:00+03:00" → "2025-09-04T10:30" (duvar saati)
 */
function isoToDatetimeLocal(isoStr: string): string {
  const clubWallTime = toClubTime(new Date(isoStr));
  const year = clubWallTime.getFullYear();
  const month = String(clubWallTime.getMonth() + 1).padStart(2, "0");
  const day = String(clubWallTime.getDate()).padStart(2, "0");
  const hours = String(clubWallTime.getHours()).padStart(2, "0");
  const minutes = String(clubWallTime.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Datetime-local input'ın value'sini ISO string'e (UTC) çevirir.
 * "2025-09-04T10:30" (Europe/Istanbul duvar saati) → "...T07:30:00.000Z"
 *
 * `fromClubTime` (bkz. lib/calendar/date-utils.ts) zaten tam olarak bunu
 * yapıyor — conflict-detection.ts'teki `clubWallClockToUtc` de aynı yardımcıyı
 * kullanıyor; burada da aynı kalıp izleniyor, ayrı bir dönüşüm icat edilmiyor.
 */
function datetimeLocalToIso(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const wallClock = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return fromClubTime(wallClock).toISOString();
}

export function EventForm({
  initialValues,
  onSubmit,
  submitLabel,
  showDelete,
  onDelete,
}: EventFormProps) {
  const [values, setValues] = useState({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    startAt: initialValues?.startAt ? isoToDatetimeLocal(initialValues.startAt) : "",
    endAt: initialValues?.endAt ? isoToDatetimeLocal(initialValues.endAt) : "",
    isAllDay: initialValues?.isAllDay ?? false,
    status: initialValues?.status ?? "fikir",
    location: initialValues?.location ?? "",
    expectedAttendance: initialValues?.expectedAttendance?.toString() ?? "",
    colorOverride: initialValues?.colorOverride ?? "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const errors: Record<string, string[]> = {};

    if (!values.title.trim()) {
      errors.title = ["Başlık gerekli"];
    }

    if (values.startAt && values.endAt) {
      const start = new Date(values.startAt);
      const end = new Date(values.endAt);
      if (end.getTime() <= start.getTime()) {
        errors.endAt = ["Bitiş zamanı başlangıçtan sonra olmalı."];
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload: EventFormValues = {
        title: values.title,
        description: values.description || undefined,
        startAt: datetimeLocalToIso(values.startAt),
        endAt: datetimeLocalToIso(values.endAt),
        isAllDay: values.isAllDay,
        status: values.status,
        location: values.location || undefined,
        expectedAttendance: values.expectedAttendance ? parseInt(values.expectedAttendance, 10) : undefined,
        colorOverride: values.colorOverride || undefined,
      };

      const result = await onSubmit(payload);

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
    if (!window.confirm("Etkinliği silmek istediğinize emin misiniz?")) return;
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
          Başlık *
        </label>
        <input
          type="text"
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={isSubmitting}
        />
        {fieldErrors.title && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.title[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Açıklama
        </label>
        <textarea
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            Başlama *
          </label>
          <input
            type="datetime-local"
            value={values.startAt}
            onChange={(e) => setValues({ ...values, startAt: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            Bitiş *
          </label>
          <input
            type="datetime-local"
            value={values.endAt}
            onChange={(e) => setValues({ ...values, endAt: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            disabled={isSubmitting}
          />
          {fieldErrors.endAt && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.endAt[0]}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isAllDay"
          checked={values.isAllDay}
          onChange={(e) => setValues({ ...values, isAllDay: e.target.checked })}
          className="rounded"
          disabled={isSubmitting}
        />
        <label htmlFor="isAllDay" className="text-sm font-medium text-gray-900 dark:text-white">
          Tüm gün
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Durum
        </label>
        <select
          value={values.status}
          onChange={(e) => setValues({ ...values, status: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={isSubmitting}
        >
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Konum
        </label>
        <input
          type="text"
          value={values.location}
          onChange={(e) => setValues({ ...values, location: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Beklenen katılımcı sayısı
        </label>
        <input
          type="number"
          min="0"
          value={values.expectedAttendance}
          onChange={(e) => setValues({ ...values, expectedAttendance: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Renk
        </label>
        <input
          type="text"
          value={values.colorOverride}
          onChange={(e) => setValues({ ...values, colorOverride: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="Örn: #ff0000 veya red"
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
