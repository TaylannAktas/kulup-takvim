"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AvailabilityHeatmap } from "@/components/availability/AvailabilityHeatmap";
import {
  computeWeeklyAvailability,
  findBestWindows,
  type AvailabilitySlot,
  type AvailabilityMember,
  type AvailabilityCourseSession,
} from "@/lib/availability/overlap";

type AudienceType = "uye" | "hedef_kitle" | "both";

const WEEKDAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const WEEKDAY_SHORTS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/**
 * Find the next date on or after today that matches the given ISO weekday (1-7, Mon-Sun).
 * We convert ISO weekday to our 1-6 (Mon-Sat) format.
 */
function nextDateForWeekday(ourWeekday: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // our weekday is 1-6 (Mon-Sat), but Date.getDay() returns 0-6 (Sun-Sat)
  // Convert: 1 -> Mon (1), 2 -> Tue (2), ..., 6 -> Sat (6)
  const targetDayOfWeek = ourWeekday; // 1-6 maps to Mon-Sat

  let daysToAdd = 0;
  const currentDayOfWeek = today.getDay();
  // currentDayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // We want to find the next occurrence of targetDayOfWeek (1-6, Mon-Sat)

  if (currentDayOfWeek === 0) {
    // Today is Sunday
    daysToAdd = targetDayOfWeek; // Mon=1, Tue=2, ..., Sat=6
  } else if (targetDayOfWeek >= currentDayOfWeek) {
    daysToAdd = targetDayOfWeek - currentDayOfWeek;
  } else {
    // Next week
    daysToAdd = 7 - currentDayOfWeek + targetDayOfWeek;
  }

  const result = new Date(today);
  result.setDate(result.getDate() + daysToAdd);

  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, "0");
  const day = String(result.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function percentageToText(ratio: number): string {
  return `%${Math.round(ratio * 100)}`;
}

export default function AvailabilityPage() {
  const [audience, setAudience] = useState<AudienceType>("both");
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [duration, setDuration] = useState(60);

  const [membersFull, setMembersFull] = useState<Array<{ id: string; displayName: string; category: string; courseCodes: string[] | null }>>(
    []
  );
  const [sessions, setSessions] = useState<AvailabilityCourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [bestWindows, setBestWindows] = useState<
    Array<{ weekday: number; startMinutes: number; endMinutes: number; averageFreeRatio: number }>
  >([]);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, sessionsRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/course-sessions"),
        ]);

        if (!membersRes.ok || !sessionsRes.ok) {
          throw new Error("Veri yükleme başarısız");
        }

        const membersData = await membersRes.json();
        const sessionsData = await sessionsRes.json();

        setMembersFull(membersData.members || []);
        setSessions(sessionsData.sessions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Recompute availability when filters or data change
  useEffect(() => {
    if (membersFull.length === 0) {
      setSlots([]);
      setBestWindows([]);
      return;
    }

    // Filter members by audience
    const filtered =
      audience === "both"
        ? membersFull
        : membersFull.filter((m) => m.category === audience);

    // Convert to AvailabilityMember format
    const filteredMembers: AvailabilityMember[] = filtered.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      courseCodes: m.courseCodes,
    }));

    if (filteredMembers.length === 0) {
      setSlots([]);
      setBestWindows([]);
      return;
    }

    // Parse day start/end
    const [startH, startM] = dayStart.split(":").map(Number);
    const [endH, endM] = dayEnd.split(":").map(Number);
    const dayStartMinutes = startH * 60 + startM;
    const dayEndMinutes = endH * 60 + endM;

    // Compute availability
    const computed = computeWeeklyAvailability({
      members: filteredMembers,
      sessions,
      dayStartMinutes,
      dayEndMinutes,
      slotMinutes: 30,
    });

    setSlots(computed);

    // Find best windows
    const windows = findBestWindows(computed, duration, 30, 10);
    setBestWindows(windows);
  }, [membersFull, sessions, audience, dayStart, dayEnd, duration]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-gray-500">Veriler yükleniyor...</p>
      </div>
    );
  }

  if (membersFull.length === 0) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-lg font-semibold">Uygunluk Analizi</h1>
        <p className="text-sm text-gray-500">
          Üye verisi bulunmuyor. Lütfen önce üyeler ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-lg font-semibold">Uygunluk Analizi</h1>
        <p className="text-sm text-gray-500">
          Seçilen kitlede kaç kişinin hangi gün×saatte boş olduğunu gösterir.
          Analiz haftalık ders programı desenine dayanır.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          Hata: {error}
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Audience selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Kitle
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  value="uye"
                  checked={audience === "uye"}
                  onChange={(e) => setAudience(e.target.value as AudienceType)}
                  className="cursor-pointer"
                />
                <span className="text-sm">Üyeler</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  value="hedef_kitle"
                  checked={audience === "hedef_kitle"}
                  onChange={(e) => setAudience(e.target.value as AudienceType)}
                  className="cursor-pointer"
                />
                <span className="text-sm">Hedef Kitle</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  value="both"
                  checked={audience === "both"}
                  onChange={(e) => setAudience(e.target.value as AudienceType)}
                  className="cursor-pointer"
                />
                <span className="text-sm">İkisi</span>
              </label>
            </div>
          </div>

          {/* Day range */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Başlangıç Saati
              </label>
              <input
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Bitiş Saati
              </label>
              <input
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            En Uygun Aralık Süresi: {duration} dakika
          </label>
          <input
            type="range"
            min="30"
            max="240"
            step="30"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Heatmap */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Haftalık Uygunluk Isı Haritası
        </h2>
        <AvailabilityHeatmap slots={slots} />
      </div>

      {/* Best windows */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          En Uygun Zaman Aralıkları
        </h2>
        {bestWindows.length === 0 ? (
          <p className="text-sm text-gray-500">
            {slots.length === 0
              ? "Hiçbir zaman aralığı bulunmadı."
              : "Seçilen süreye uygun ardışık zaman aralığı bulunmadı."}
          </p>
        ) : (
          <ul className="space-y-2">
            {bestWindows.map((window, idx) => {
              const nextDate = nextDateForWeekday(window.weekday);
              const startTime = minutesToTime(window.startMinutes);
              const endTime = minutesToTime(window.endMinutes);
              const percentage = percentageToText(window.averageFreeRatio);

              return (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {WEEKDAY_NAMES[window.weekday - 1]} {startTime}-{endTime} ({percentage}{" "}
                      boş)
                    </div>
                    <div className="text-xs text-gray-500">
                      Tarih: {new Date(nextDate).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                  <Link
                    href={`/calendar?newEvent=1&day=${nextDate}`}
                    className="whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                  >
                    Etkinlik Oluştur
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
