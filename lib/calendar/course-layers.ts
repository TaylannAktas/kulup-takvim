/**
 * Ders programı katman ad alanları — hem sunucu (`month-events.ts`, bar
 * üretimi) hem istemci (`CourseSchedulePanel.tsx`, seçim linkleri) tarafından
 * kullanılıyor. `server-only` OLMAYAN ayrı bir dosyada tutuluyor ki istemci
 * bileşenleri bunu import ederken `lib/db`'yi (ve onun üzerinden tüm
 * kazıyıcı zincirini) build'e sürüklemesin — `conflict-types.ts` ile aynı
 * gerekçe/desen (bkz. Faz 3).
 */
export const COURSE_LAYER_NAMESPACE = {
  import: "course-import",
  room: "course-room",
  course: "course-course",
} as const;
