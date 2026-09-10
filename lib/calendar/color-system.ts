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
  },
  academic_ders_donemi: {
    label: "Dönem sınırı",
    icon: "―",
    barClassName: "border-t-2 border-blue-600 text-blue-800",
    heatmapBackgroundClassName: "bg-blue-50 dark:bg-blue-950/30",
    borderStyle: "solid",
  },
  academic_kayit: {
    label: "Kayıt",
    icon: "▮",
    barClassName: "bg-blue-600 text-white",
    heatmapBackgroundClassName: "bg-cyan-50 dark:bg-cyan-950/30",
    borderStyle: "solid",
  },
  academic_idari: {
    label: "İdari",
    icon: "▮",
    barClassName: "bg-gray-400 text-gray-950",
    heatmapBackgroundClassName: "bg-gray-100 dark:bg-gray-800/40",
    borderStyle: "solid",
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

export type AcademicCategory = "SINAV" | "TATIL" | "DERS_DONEMI" | "KAYIT" | "IDARI";

/** academic_calendar_entries.category -> EventKind eşlemesi. */
export function academicCalendarKindFromCategory(category: AcademicCategory): EventKind {
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

/**
 * Akademik kategori → saf RGB baz renk. Hücre fon harmanlaması ve çakışma
 * segmentleri için tek kaynak (kullanıcı isteği, 2026-09-10 — kenar/çerçeve
 * sistemi yerine tam-aralık fon rengi). SINAV da dahil — eski çerçeve
 * sisteminde SINAV kategorisinin hiç görsel karşılığı yoktu (bir boşluktu),
 * burada `exam_arasinav`'ın bar rengiyle tutarlı turuncu aile kullanılıyor.
 */
export const ACADEMIC_BASE_RGB: Record<AcademicCategory, [number, number, number]> = {
  SINAV: [234, 88, 12], // orange-600
  TATIL: [120, 113, 108], // stone-500
  DERS_DONEMI: [37, 99, 235], // blue-600
  KAYIT: [8, 145, 178], // cyan-600
  IDARI: [107, 114, 128], // gray-500
};

/**
 * Bir günü kapsayan akademik kategorilerin baz renklerini sıralı "over"
 * alpha-composite ile karıştırır (basit, karmaşık renk-uzayı dönüşümü yok —
 * kullanıcı onayı, 2026-09-10). Light/dark için ayrı alfa döner (dark modda
 * biraz daha yüksek alfa — koyu zemin üstünde pastel tonun kaybolmaması
 * için). Çağıran taraf bu değerleri CSS custom property olarak enjekte edip
 * `bg-[var(--x)] dark:bg-[var(--y)]` gibi SABİT (literal) bir Tailwind
 * arbitrary-value class'ıyla tüketir — class adının kendisi build zamanında
 * taranabilir sabit bir string olduğu için Tailwind JIT'in "dinamik class
 * üretemez" kısıtına takılmaz (kısıt class ADI için, CSS değişkeninin
 * DEĞERİ için değil).
 */
export function blendAcademicColors(
  categories: AcademicCategory[]
): { light: string; dark: string } | undefined {
  const unique = [...new Set(categories)];
  if (unique.length === 0) return undefined;

  const compositeOver = (alpha: number) => {
    let r = 255;
    let g = 255;
    let b = 255;
    let a = 0;
    for (const cat of unique) {
      const [cr, cg, cb] = ACADEMIC_BASE_RGB[cat];
      const newA = alpha + a * (1 - alpha);
      r = (cr * alpha + r * a * (1 - alpha)) / newA;
      g = (cg * alpha + g * a * (1 - alpha)) / newA;
      b = (cb * alpha + b * a * (1 - alpha)) / newA;
      a = newA;
    }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
  };

  return { light: compositeOver(0.16), dark: compositeOver(0.3) };
}

/** Çakışma segmentleri için saf (harmanlanmamış) renk — küçük çizgi işaretleri. */
export function academicSolidRgb(category: AcademicCategory): string {
  const [r, g, b] = ACADEMIC_BASE_RGB[category];
  return `rgb(${r}, ${g}, ${b})`;
}

/** Tooltip için Türkçe kategori etiketi — mevcut EVENT_STYLES etiketleriyle aynı kaynak. */
export function academicCategoryLabel(category: AcademicCategory): string {
  return EVENT_STYLES[academicCalendarKindFromCategory(category)].label;
}
