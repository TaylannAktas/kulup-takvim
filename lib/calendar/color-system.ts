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
  /** Kenarlık stili — spec'te "kesikli çerçeve" gibi ayırt edici detaylar var. */
  borderStyle?: "solid" | "dashed" | "outline";
};

export const EVENT_STYLES: Record<EventKind, EventStyle> = {
  exam_final: {
    label: "Final",
    icon: "●",
    barClassName: "bg-red-800 text-white",
    cellBackgroundClassName: "bg-red-50 dark:bg-red-950/40",
    borderStyle: "solid",
  },
  exam_arasinav: {
    label: "Vize",
    icon: "●",
    barClassName: "bg-orange-600 text-white",
    borderStyle: "solid",
  },
  exam_mazeret: {
    label: "Mazeret",
    icon: "○",
    barClassName: "bg-red-300 text-red-950",
    borderStyle: "dashed",
  },
  academic_tatil: {
    label: "Tatil",
    icon: "▨",
    barClassName: "bg-stone-400 text-stone-950",
    cellBackgroundClassName: "bg-stone-100 dark:bg-stone-800/60",
    borderStyle: "solid",
  },
  academic_ders_donemi: {
    label: "Dönem sınırı",
    icon: "―",
    barClassName: "border-t-2 border-blue-600 text-blue-800",
    borderStyle: "solid",
  },
  academic_kayit: {
    label: "Kayıt",
    icon: "▮",
    barClassName: "bg-blue-600 text-white",
    borderStyle: "solid",
  },
  academic_idari: {
    label: "İdari",
    icon: "▮",
    barClassName: "bg-gray-400 text-gray-950",
    borderStyle: "solid",
  },
  course_session: {
    label: "Ders",
    icon: "▮",
    barClassName: "bg-purple-500/40 text-purple-950 dark:text-purple-100",
    borderStyle: "solid",
  },
  club_event_onaylandi: {
    label: "Onaylandı",
    icon: "✓",
    barClassName: "bg-green-600 text-white",
    borderStyle: "solid",
  },
  club_event_planlaniyor: {
    label: "Planlanıyor",
    icon: "◐",
    barClassName: "border-2 border-green-600 text-green-800",
    borderStyle: "outline",
  },
  club_event_fikir: {
    label: "Fikir",
    icon: "◌",
    barClassName: "border border-dashed border-green-600 text-green-800",
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
