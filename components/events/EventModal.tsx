"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventForm } from "./EventForm";
import { ConflictBadge } from "./ConflictBadge";
import { hasAnyConflict, type ConflictFlags } from "@/lib/calendar/conflict-types";
import { fromClubTime } from "@/lib/calendar/date-utils";

type EventModalProps = {
  mode: "create" | "edit";
  eventId?: string;
  defaultDate?: string; // ISO date (YYYY-MM-DD)
  canEdit: boolean;
};

/**
 * Varsayılan başlangıç zamanı: eğer bir gün seçili ise o güne 09:00, aksi
 * halde "şimdi"yi sonraki yarım saate yuvarla.
 */
function getDefaultStartTime(defaultDate?: string): string {
  if (defaultDate) {
    // Duvar saati 09:00 anlamında bir UTC instant oluştur
    const [year, month, day] = defaultDate.split("-").map(Number);
    const wallTime = new Date(year, month - 1, day, 9, 0, 0, 0);
    return fromClubTime(wallTime).toISOString();
  }

  // Şimdi + sonraki yarım saat
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 0;
  const hours = minutes < 30 ? now.getHours() : (now.getHours() + 1) % 24;

  const rounded = new Date(now);
  rounded.setHours(hours, roundedMinutes, 0, 0);
  return rounded.toISOString();
}

export function EventModal({ mode, eventId, defaultDate, canEdit }: EventModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(mode === "edit");
  const [eventData, setEventData] = useState<any | null>(null);
  const [showConflictConfirm, setShowConflictConfirm] = useState(false);
  const [lastSavedConflicts, setLastSavedConflicts] = useState<ConflictFlags | null>(null);

  // Edit modunda veriyi yükle
  useEffect(() => {
    if (mode !== "edit" || !eventId) return;

    let isMounted = true;

    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) throw new Error(`Yüklenemiyor: ${res.statusText}`);
        const data = await res.json();
        if (isMounted) setEventData(data.event);
      } catch (err) {
        console.error("Etkinlik yükleme hatası:", err);
        if (isMounted) {
          // Yükleme başarısız olursa kapat
          handleClose();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchEvent();
    return () => {
      isMounted = false;
    };
  }, [mode, eventId]);

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("newEvent");
    params.delete("editEvent");
    router.push(`/calendar${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    router.refresh();
  }

  async function handleSubmit(values: any): Promise<{ ok: true; event: any } | { ok: false; error: string }> {
    try {
      const url = mode === "create" ? "/api/events" : `/api/events/${eventId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const payload = mode === "create" ? values : { ...values, expectedUpdatedAt: eventData.updatedAt };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json();
        alert("Bu kayıt siz düzenlerken değişti, güncel veriyle yeniden açılıyor.");
        setEventData(data.current);
        return { ok: false, error: "" };
      }

      if (!res.ok) {
        const data = await res.json();
        if (data.error?.fieldErrors) {
          return { ok: false, error: JSON.stringify(data.error.fieldErrors) };
        }
        return { ok: false, error: data.error?.message || "Kaydedilemedi" };
      }

      const result = await res.json();
      const savedEvent = result.event;

      // Çakışma varsa göster, yoksa kapat
      if (hasAnyConflict(savedEvent.conflictFlags)) {
        setLastSavedConflicts(savedEvent.conflictFlags);
        setShowConflictConfirm(true);
        return { ok: true, event: savedEvent };
      }

      handleClose();
      return { ok: true, event: savedEvent };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
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

  if (showConflictConfirm && lastSavedConflicts) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Etkinlik kaydedildi.
          </h2>
          <div className="mb-6">
            <ConflictBadge flags={lastSavedConflicts} />
          </div>
          <button
            onClick={handleClose}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const initialValues =
    mode === "edit" && eventData
      ? {
          title: eventData.title,
          description: eventData.description,
          startAt: eventData.startAt,
          endAt: eventData.endAt,
          isAllDay: eventData.isAllDay,
          status: eventData.status,
          location: eventData.location,
          expectedAttendance: eventData.expectedAttendance,
          colorOverride: eventData.colorOverride,
        }
      : mode === "create"
        ? {
            startAt: getDefaultStartTime(defaultDate),
            endAt: new Date(new Date(getDefaultStartTime(defaultDate)).getTime() + 60 * 60 * 1000).toISOString(),
          }
        : undefined;

  const submitLabel = mode === "create" ? "Oluştur" : "Güncelle";
  const showDelete = mode === "edit" && canEdit;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 dark:text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Yeni Etkinlik" : "Etkinliği Düzenle"}
          </h2>
          <button
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <EventForm
            initialValues={initialValues}
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
