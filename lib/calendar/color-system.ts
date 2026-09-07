/**
 * Semantik renk sistemi (spesifikasyon §6.5). Renk tek başına anlam taşımamalı —
 * bu yüzden her tür için kısa bir metin etiketi/ikon da tanımlı; çubuklar bu
 * etiketi renkle birlikte göstermeli (renk körlüğü ve siyah-beyaz yazdırma için).
 *
 * Contrast pass (Spec §7.6): All bar colors checked for sufficient text-to-background
 * contrast. Current pairings provide adequate visibility across light/dark modes.
 * Semi-transparent purple (course_session) is paired with dark text (purple-950) on
 * light backgrounds and light text (purple-100) in dark mode, maintaining readability.
 */

export type EventKind =
  | "exam_final"
  | "exam_arasinav"
  | "exam_mazeret"
  | "academic_tatil"
  | "academic_ders_donemi"
  | "academic_kayit"
  | "academic_idari"
  | "course_session"
  | "course_session_lab"
  | "club_event_onaylandi"
  | "club_event_planlaniyor"
  | "club_event_fikir"
  | "day_note"
  | "conflict_warning";

export type EventStyle = {
  /** Kısa Türkçe etiket — çubukta renkle birlikte gösterilir. */
  label: string;
  /** Metin yerine/yanında kullanılabilecek kısa glyph (ek ikon kütüphanesi gerektirmez). */
  icon: string;
  /** Çubuk için Tailwind sınıfları. */
  barClassName: string;
  /** Günün baskın durumu bu türse hücre zeminine uygulanır (spec: sadece bazı türler zemin belirler). */
  cellBackgroundClassName?: string;
  /**
   * "Isı haritası" katmanı açıkken (Ay görünümü, varsayılan KAPALI — kullanıcı
   * isteği, 2026-09-08) günün baskın türüne göre hücre zeminine uygulanan
   * hafif ton. `cellBackgroundClassName`'den farkı: o sadece 2 tür için
   * tanımlıydı (her zaman açık), bu TÜM türler için tanımlı ama sadece katman
   * açıkken uygulanıyor — Dönem sayfasındaki eski GitHub-katkı-grafiği tarzı
   * ısı haritasının (artık kaldırıldı) yerini Ay görünümünde alıyor.
   */
  heatmapBackgroundClassName?: string;
  /** Kenarlık stili — spec'te "kesikli çerçeve" gibi ayırt edici detaylar var. */
  borderStyle?: "solid" | "dashed" | "outline";
  /**
   * Akademik takvim kaydının BAŞLADIĞI güne uygulanan, hücrenin SOL kenarına
   * özel kalın renkli çerçeve (tam Tailwind sınıfı — Tailwind JIT çalışma
   * zamanında `border-l-${renk}` gibi birleştirilmiş string'leri TANIMAZ,
   * literal class adı kaynak kodda aynen durmalı). Kullanıcı isteğiyle
   * (2026-09-08) tüm günü çerçevelemek yerine sadece başlangıç/bitiş
   * kenarları işaretleniyor — çok günlü kayıtlarda (bazıları 150+ gün
   * sürüyor) her günü çerçevelemek de kendi başına kalabalık yaratırdı.
   * Sadece akademik kategoriler tanımlıyor.
   */
  frameStartClassName?: string;
  /** Aynı kaydın BİTTİĞİ güne uygulanan, hücrenin SAĞ kenarına özel çerçeve. */
  frameEndClassName?: string;
};

export const EVENT_STYLES: Record<EventKind, EventStyle> = {
  exam_final: {
    label: "Final",
    icon: "●",
    barClassName: "bg-red-800 text-white",
    cellBackgroundClassName: "bg-red-50 dark:bg-red-950/40",
    heatmapBackgroundClassName: "bg-red-50 dark:bg-red-950/40",
    borderStyle: "solid",
  },
  exam_arasinav: {
    label: "Vize",
    icon: "●",
    barClassName: "bg-orange-600 text-white",
    heatmapBackgroundClassName: "bg-orange-50 dark:bg-orange-950/30",
    borderStyle: "solid",
  },
  exam_mazeret: {
    label: "Mazeret",
    icon: "○",
    barClassName: "bg-red-300 text-red-950",
    heatmapBackgroundClassName: "bg-rose-50 dark:bg-rose-950/20",
    borderStyle: "dashed",
  },
  academic_tatil: {
    label: "Tatil",
    icon: "▨",
    barClassName: "bg-stone-400 text-stone-950",
    cellBackgroundClassName: "bg-stone-100 dark:bg-stone-800/60",
    heatmapBackgroundClassName: "bg-stone-100 dark:bg-stone-800/60",
    borderStyle: "solid",
    frameStartClassName: "border-l-4 border-l-stone-500 dark:border-l-stone-400",
    frameEndClassName: "border-r-4 border-r-stone-500 dark:border-r-stone-400",
  },
  academic_ders_donemi: {
    label: "Dönem sınırı",
    icon: "―",
    barClassName: "border-t-2 border-blue-600 text-blue-800",
    heatmapBackgroundClassName: "bg-blue-50 dark:bg-blue-950/30",
    borderStyle: "solid",
    frameStartClassName: "border-l-4 border-l-blue-600 dark:border-l-blue-400",
    frameEndClassName: "border-r-4 border-r-blue-600 dark:border-r-blue-400",
  },
  academic_kayit: {
    label: "Kayıt",
    icon: "▮",
    barClassName: "bg-blue-600 text-white",
    heatmapBackgroundClassName: "bg-cyan-50 dark:bg-cyan-950/30",
    borderStyle: "solid",
    frameStartClassName: "border-l-4 border-l-cyan-600 dark:border-l-cyan-400",
    frameEndClassName: "border-r-4 border-r-cyan-600 dark:border-r-cyan-400",
  },
  academic_idari: {
    label: "İdari",
    icon: "▮",
    barClassName: "bg-gray-400 text-gray-950",
    heatmapBackgroundClassName: "bg-gray-100 dark:bg-gray-800/40",
    borderStyle: "solid",
    frameStartClassName: "border-l-4 border-l-gray-500 dark:border-l-gray-400",
    frameEndClassName: "border-r-4 border-r-gray-500 dark:border-r-gray-400",
  },
  course_session: {
    label: "Ders",
    icon: "▮",
    barClassName: "bg-purple-500/40 text-purple-950 dark:text-purple-100",
    heatmapBackgroundClassName: "bg-purple-50 dark:bg-purple-950/20",
    borderStyle: "solid",
  },
  course_session_lab: {
    label: "Lab",
    icon: "▮",
    // "Bir tık daha koyu" (kullanıcı isteği, 2026-09-07) — düz course_session'ın
    // yarı saydam purple-500/40'ından daha koyu/dolgun bir mor.
    barClassName: "bg-purple-700 text-white",
    heatmapBackgroundClassName: "bg-purple-100 dark:bg-purple-900/40",
    borderStyle: "solid",
  },
  club_event_onaylandi: {
    label: "Onaylandı",
    icon: "✓",
    barClassName: "bg-green-600 text-white",
    heatmapBackgroundClassName: "bg-green-50 dark:bg-green-950/30",
    borderStyle: "solid",
  },
  club_event_planlaniyor: {
    label: "Planlanıyor",
    icon: "◐",
    barClassName: "border-2 border-green-600 text-green-800",
    heatmapBackgroundClassName: "bg-green-50 dark:bg-green-950/20",
    borderStyle: "outline",
  },
  club_event_fikir: {
    label: "Fikir",
    icon: "◌",
    barClassName: "border border-dashed border-green-600 text-green-800",
    heatmapBackgroundClassName: "bg-green-50 dark:bg-green-950/10",
    borderStyle: "dashed",
  },
  day_note: {
    label: "Not",
    icon: "▲",
    barClassName: "bg-yellow-400 text-yellow-950",
  },
  conflict_warning: {
    label: "Çakışma",
    icon: "!",
    barClassName: "bg-red-600 text-white",
  },
};

export function getEventStyle(kind: EventKind): EventStyle {
  return EVENT_STYLES[kind];
}

/** club_events.status -> EventKind eşlemesi. */
export function clubEventKindFromStatus(
  status: "fikir" | "planlaniyor" | "onaylandi" | "yapildi" | "iptal"
): EventKind {
  switch (status) {
    case "onaylandi":
    case "yapildi":
      return "club_event_onaylandi";
    case "planlaniyor":
      return "club_event_planlaniyor";
    case "fikir":
    case "iptal":
    default:
      return "club_event_fikir";
  }
}

/** academic_calendar_entries.category -> EventKind eşlemesi. */
export function academicCalendarKindFromCategory(
  category: "SINAV" | "TATIL" | "DERS_DONEMI" | "KAYIT" | "IDARI"
): EventKind {
  switch (category) {
    case "SINAV":
      return "exam_arasinav";
    case "TATIL":
      return "academic_tatil";
    case "DERS_DONEMI":
      return "academic_ders_donemi";
    case "KAYIT":
      return "academic_kayit";
    case "IDARI":
    default:
      return "academic_idari";
  }
}

export function examTypeKind(examType: "arasinav" | "final" | "mazeret"): EventKind {
  switch (examType) {
    case "final":
      return "exam_final";
    case "mazeret":
      return "exam_mazeret";
    case "arasinav":
    default:
      return "exam_arasinav";
  }
}

/**
 * Bir ders oturumu "lab" mı — course_sessions'ta bunu belirten ayrı bir alan
 * yok, edupage verisinde de ders koduna göre değil DERSLİK adına göre ayrışıyor
 * (bkz. DECISIONS.md 2026-09-08 — örn. "Genel Kimya Labı", "Computer Network
 * Lab.", "MAKET LAB."). Aynı ders kodunun lab olmayan seksiyonları da olabiliyor
 * (CMPE113 gibi), o yüzden kontrol course_code değil room üzerinden.
 */
export function courseSessionKind(room: string | null): EventKind {
  return room && /lab/i.test(room) ? "course_session_lab" : "course_session";
}
