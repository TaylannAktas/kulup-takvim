"use client";

import { useState } from "react";

type Room = { code: string; building: string | null; capacity: number | null };
type CourseSession = {
  room: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
};

type FreeRoomFinderProps = {
  /** Sonuçtan doğrudan etkinlik konumu seçilebilsin diye (spec §7.3). */
  onSelectRoom?: (roomCode: string) => void;
};

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** ISO tarihten haftanın günü (1=Pzt ... 7=Paz), ders programı verisiyle aynı kural. */
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Paz..6=Cmt
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * "Şu tarihte şu saatler arası hangi derslikler boş?" (spec §7.3).
 * Ders programı verisi zaten derslik dolu/boş bilgisini içeriyor — ek bir
 * kaynağa gerek yok, sadece rooms + course_sessions'ı çapraz kontrol ediyoruz.
 */
export function FreeRoomFinder({ onSelectRoom }: FreeRoomFinderProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("17:00");
  const [minCapacity, setMinCapacity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeRooms, setFreeRooms] = useState<Room[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Bir tarih seçin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const weekday = weekdayOf(date);
      const [roomsRes, sessionsRes] = await Promise.all([
        fetch("/api/rooms"),
        fetch(`/api/course-sessions?weekday=${weekday}`),
      ]);
      if (!roomsRes.ok || !sessionsRes.ok) throw new Error("Veri alınamadı.");

      const { rooms }: { rooms: Room[] } = await roomsRes.json();
      const { sessions }: { sessions: CourseSession[] } = await sessionsRes.json();

      const queryStart = parseMinutes(startTime);
      const queryEnd = parseMinutes(endTime);

      const occupied = new Set(
        sessions
          .filter((s) => s.room && s.startTime && s.endTime)
          .filter((s) => {
            const sStart = parseMinutes(s.startTime!);
            const sEnd = parseMinutes(s.endTime!);
            return sStart < queryEnd && queryStart < sEnd;
          })
          .map((s) => s.room!)
      );

      const capacityFilter = minCapacity ? Number(minCapacity) : null;
      const result = rooms
        .filter((r) => !occupied.has(r.code))
        .filter((r) => capacityFilter === null || (r.capacity ?? 0) >= capacityFilter);

      setFreeRooms(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Başlangıç</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Bitiş</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Min. kapasite</label>
          <input
            type="number"
            min="0"
            value={minCapacity}
            onChange={(e) => setMinCapacity(e.target.value)}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {loading ? "Aranıyor..." : "Boş derslik bul"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {freeRooms && (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {freeRooms.map((room) => (
            <li key={room.code} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {room.code}
                {room.building && <span className="text-gray-400"> · {room.building}</span>}
                {room.capacity != null && <span className="text-gray-400"> · {room.capacity} kişi</span>}
              </span>
              {onSelectRoom && (
                <button
                  type="button"
                  onClick={() => onSelectRoom(room.code)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Konum olarak seç
                </button>
              )}
            </li>
          ))}
          {freeRooms.length === 0 && (
            <li className="py-4 text-center text-xs text-gray-400">Bu aralıkta boş derslik yok.</li>
          )}
        </ul>
      )}
    </div>
  );
}
