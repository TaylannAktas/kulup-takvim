/**
 * edupage ders programı ayrıştırıcısı — "Web Sayfası, Tamamı" ile kaydedilmiş
 * dosyanın içindeki SVG grid'ini okur.
 *
 * AĞA HİÇ DOKUNMAZ. edupage.org `robots.txt` otomatik erişimi reddediyor
 * (spec §4.3 / DECISIONS.md); bu modülün tek girdisi kullanıcının kendi
 * tarayıcısından elle kaydedip yüklediği HTML metnidir.
 *
 * Spesifikasyonun varsaydığı gömülü JSON (`ttview`/`dbi`/`datarows`) güncel
 * edupage dağıtımlarında YOK — veri aSc Ders Planlayıcı'nın SVG render'ı olarak
 * geliyor (DECISIONS.md "edupage gerçek yapısı", 2026-09-04).
 *
 * Ağ/DB erişimi yok ve `server-only` import edilmiyor — diğer ayrıştırıcılarla
 * (`lib/scrapers/<kaynak>/parse.ts`) aynı düzen: gerçek fixture ile Vitest'te
 * çalıştırılabilsin diye.
 */
import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

/** Dönem sütunlarının başladığı SVG x koordinatı. */
const GRID_ORIGIN_X = 345;
/** Bir dönem sütununun genişliği (SVG birimi). */
const PERIOD_COLUMN_WIDTH = 213.75;
/** Gün satırlarının başladığı SVG y koordinatı. */
const GRID_ORIGIN_Y = 420;
/** Bir gün satırının yüksekliği (SVG birimi). */
const DAY_ROW_HEIGHT = 255;
/** Pazartesi–Cumartesi. Pazar ders günü olmadığı için hiç çizilmiyor. */
const DAY_ROW_COUNT = 6;

/** Kayan nokta gürültüsüne karşı pay (127.5/255 gibi yarım değerler var). */
const EPSILON = 1e-6;

/** `course_sessions` tablosunun eklenebilir alanları (`id`/`importId` hariç). */
export type ParsedCourseSession = {
  courseCode: string;
  courseName: string | null;
  section: string;
  /**
   * Tek sınıf görünümünden güvenilir çıkarılamayan üç alan (DECISIONS.md
   * "Kapsam dışı kalan alanlar"): bilinçli olarak her zaman null.
   */
  facultyCode: null;
  programName: null;
  classYear: null;
  /** ISO gün numarası: Pazartesi=1 … Cumartesi=6. */
  weekday: number;
  /** `HH:MM` (sıfır dolgulu). */
  startTime: string;
  /** `HH:MM` (sıfır dolgulu). */
  endTime: string;
  room: string | null;
  instructor: string | null;
};

/** Bir ders saati sütunu. */
export type ParsedPeriod = {
  /** 0 tabanlı sütun indeksi (dönem 1 → 0). */
  index: number;
  /** `HH:MM` */
  startTime: string;
  /** `HH:MM` */
  endTime: string;
  /** Kaynaktaki ham metin, örn. `"9:30 - 10:20"`. */
  rawLabel: string;
};

export type TimetableParseResult = {
  rows: ParsedCourseSession[];
  warnings: string[];
  /**
   * Bu sayfadaki dönem (saat) sütunları — kullanıcı raporu üzerine eklendi
   * (2026-09-07): gün ayrıntı çizelgesini "okulun sitesindeki gibi" ders
   * saatlerine bölebilmek için `timetable_imports.periods`'a kaydediliyor.
   * Daha önce sadece dahili olarak oturum saatlerini çözmek için kullanılıp
   * atılıyordu.
   */
  periods: ParsedPeriod[];
};

/** Yapı hiç tanınmadığında fırlatılan hata — çağıran katman kullanıcıya gösterir. */
export class TimetableStructureError extends Error {
  constructor(detail: string) {
    super(
      `Bu dosyanın yapısı tanınmadı: ${detail}. edupage sayfasını tarayıcıdan ` +
        `"Web Sayfası, Tamamı" olarak kaydedip tekrar deneyin.`
    );
    this.name = "TimetableStructureError";
  }
}

/**
 * Baştaki/sondaki boşlukları VE bölünmez boşlukları (`&nbsp;` → ` `) atar.
 *
 * Gerçek fixture'da bir ders adının sonunda `&nbsp;` var; düz `.trim()` onu
 * bırakır ve ders adı görünmez bir karakterle biter.
 */
export function stripEdgeWhitespace(raw: string): string {
  return raw.replace(/^[\s ]+|[\s ]+$/g, "");
}

/** `"9:30"` → `"09:30"`. Geçersizse null. */
export function normalizeClockTime(raw: string): string | null {
  const match = stripEdgeWhitespace(raw).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * `"9:30 - 10:20"` → `{ startTime: "09:30", endTime: "10:20" }`.
 *
 * Saatler ASLA sabit kodlanmıyor: okul dönem uzunluklarını değiştirse bile
 * ayrıştırıcı kırılmasın diye her dönemin saati dosyadan okunuyor.
 */
export function parseTimeRangeLabel(
  raw: string
): { startTime: string; endTime: string } | null {
  const match = stripEdgeWhitespace(raw).match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;

  const startTime = normalizeClockTime(match[1]);
  const endTime = normalizeClockTime(match[2]);
  if (!startTime || !endTime) return null;

  return { startTime, endTime };
}

/**
 * SVG y koordinatından 0 tabanlı gün satırı indeksi.
 *
 * DİKKAT — `Math.round` DEĞİL `Math.floor`. Aynı gün/saat kutusuna iki ders
 * sığdığında edupage kutuyu ikiye bölüyor ve alttaki dersin y'si satırın
 * ORTASINDA oluyor (örn. y=1567.5 → 4.5). `round(4.5)` = 5, yani Cuma dersi
 * Cumartesi'ye kayardı; gerçek fixture'da bu tam 5 dersi yanlış güne atıyor.
 */
export function dayRowIndex(y: number): number | null {
  if (!Number.isFinite(y)) return null;

  const index = Math.floor((y - GRID_ORIGIN_Y) / DAY_ROW_HEIGHT + EPSILON);
  if (index < 0 || index >= DAY_ROW_COUNT) return null;
  return index;
}

/**
 * 0 tabanlı gün satırı → ISO gün numarası (Pazartesi=1 … Cumartesi=6).
 *
 * Gün ETİKETİ hiç okunmuyor: Cuma ve Cumartesi satırlarının ikisi de `"Cu"`
 * diye render ediliyor, yani metinden ayırt edilemiyorlar. `firstDayOfWeek`
 * Pazartesi ve Pazar hiç çizilmediği için satır sırası her zaman sabit.
 */
export function weekdayFromRowIndex(rowIndex: number): number {
  return rowIndex + 1;
}

/**
 * Ders kutusunun x/width'inden kapsadığı dönem aralığı (0 tabanlı, kapsayıcı).
 * Genişlik dönem sütununun tam katı: 213.75 = 1, 427.5 = 2, 641.25 = 3 dönem.
 */
export function periodSpanFromGeometry(
  x: number,
  width: number
): { startPeriodIndex: number; periodSpan: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(width)) return null;

  const startPeriodIndex = Math.round((x - GRID_ORIGIN_X) / PERIOD_COLUMN_WIDTH);
  const periodSpan = Math.round(width / PERIOD_COLUMN_WIDTH);
  if (startPeriodIndex < 0 || periodSpan < 1) return null;

  return { startPeriodIndex, periodSpan };
}

/**
 * `<title>`'ın ilk satırını böler: `"ACL103-SEC-01-İlk ve Acil Yardım …"`.
 *
 * Ders adı OPSİYONEL: gerçek fixture'da 21 dersin 4'ü sadece `"ENG121-SEC-17"`
 * biçiminde, adsız geliyor. Bunları "bozuk" sayıp atmak gerçek ders saatlerini
 * sessizce kaybettirirdi; ad yoksa `courseName` null bırakılıyor.
 */
export function splitSessionTitle(
  firstLine: string
): { courseCode: string; section: string; courseName: string | null } | null {
  const text = stripEdgeWhitespace(firstLine);
  // `s` (dotAll) bayrağı YOK: girdi zaten tek bir satır (bkz. `splitTitleLines`)
  // ve tsconfig target'ı ES2017.
  const match = /^(.+?)-SEC-(\d+)(?:-(.*))?$/.exec(text);
  if (!match) return null;

  const courseCode = stripEdgeWhitespace(match[1]);
  const section = match[2];
  const courseName = match[3] === undefined ? null : stripEdgeWhitespace(match[3]) || null;
  if (!courseCode) return null;

  return { courseCode, section, courseName };
}

/**
 * `<title>` metnini üç satıra ayırır (ders / öğretmen / derslik).
 * Satır sayısı sabitlenmiyor; eksikse `null` döner, fazlası yok sayılmaz —
 * çağıran uyarı üretir.
 */
export function splitTitleLines(raw: string): string[] {
  return raw.split("\n").map(stripEdgeWhitespace);
}

function numAttr(el: Element, name: string): number {
  const raw = el.attribs?.[name];
  if (raw === undefined) return Number.NaN;
  return Number.parseFloat(raw);
}

/**
 * Sayfadaki gerçek program SVG'sini bulur.
 *
 * Sayfanın sonunda 1x1 piksellik bir ölçüm SVG'si daha var; onda hiç `<title>`
 * yok, ayıraç olarak bu kullanılıyor.
 */
function findTimetableSvg($: CheerioAPI): Element | null {
  const candidates = $("svg").toArray() as Element[];
  for (const svg of candidates) {
    if ($(svg).find("title").length > 0) return svg;
  }
  return null;
}

function collectPeriods($: CheerioAPI, svg: Element): ParsedPeriod[] {
  const byIndex = new Map<number, ParsedPeriod>();

  for (const el of $(svg).find("text").toArray() as Element[]) {
    const range = parseTimeRangeLabel($(el).text());
    if (!range) continue;

    const x = numAttr(el, "x");
    if (!Number.isFinite(x)) continue;

    // Saat metni sütunun ORTASINA yaslanmış: x = origin + (n * w) + w/2.
    // Sütun indeksini dönem sırası metninden ("1.") değil doğrudan
    // geometriden çıkarıyoruz — ders kutularıyla aynı koordinat sistemi.
    const index = Math.round(
      (x - GRID_ORIGIN_X - PERIOD_COLUMN_WIDTH / 2) / PERIOD_COLUMN_WIDTH
    );
    if (index < 0 || byIndex.has(index)) continue;

    byIndex.set(index, {
      index,
      startTime: range.startTime,
      endTime: range.endTime,
      rawLabel: stripEdgeWhitespace($(el).text()),
    });
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** Dosyadaki dönem sütunlarını (saat başlıklarını) döndürür. */
export function extractPeriods(html: string): ParsedPeriod[] {
  const $ = load(html);
  const svg = findTimetableSvg($);
  if (!svg) return [];
  return collectPeriods($, svg);
}

/**
 * Kaydedilmiş edupage sayfasını ders oturumlarına çevirir.
 *
 * Tek bir bozuk kutu asla hata fırlatmaz: atlanır ve `warnings`'e yazılır.
 * Hata SADECE grid yapısının kendisi bulunamadığında fırlatılır — doğrulanmış
 * bir `<table>` örneği hiç görülmediği için kör bir tablo geri düşüşü YAZILMIYOR
 * (tahmin yürütmek, sessizce yanlış oda/gün yazmaktan kötü — DECISIONS.md).
 */
export function parseEdupageTimetableSvg(html: string): TimetableParseResult {
  const $ = load(html);

  const svg = findTimetableSvg($);
  if (!svg) {
    throw new TimetableStructureError("sayfada ders programı SVG'si bulunamadı");
  }

  const periods = collectPeriods($, svg);
  if (periods.length === 0) {
    throw new TimetableStructureError("saat başlığı sütunları (örn. \"9:30 - 10:20\") bulunamadı");
  }
  const periodByIndex = new Map(periods.map((p) => [p.index, p]));

  const titledRects = ($(svg).find("rect").toArray() as Element[]).filter(
    (rect) => $(rect).children("title").length > 0
  );
  if (titledRects.length === 0) {
    throw new TimetableStructureError("ders kutusu (başlıklı <rect>) bulunamadı");
  }

  const warnings: string[] = [];
  const rows: ParsedCourseSession[] = [];

  titledRects.forEach((rect, i) => {
    const rawTitle = $(rect).children("title").first().text();
    const lines = splitTitleLines(rawTitle);
    const where = `kutu ${i} ("${lines[0] ?? ""}")`;

    if (lines.length !== 3) {
      warnings.push(
        `${where}: <title> 3 satır bekleniyordu, ${lines.length} satır bulundu.`
      );
    }

    const title = splitSessionTitle(lines[0] ?? "");
    if (!title) {
      warnings.push(
        `${where}: ders başlığı "KOD-SEC-NN[-Ders Adı]" biçimine uymuyor, kutu atlandı.`
      );
      return;
    }

    const rowIndex = dayRowIndex(numAttr(rect, "y"));
    if (rowIndex === null) {
      warnings.push(
        `${where}: gün satırı çözümlenemedi (y="${rect.attribs?.y}"), kutu atlandı.`
      );
      return;
    }

    const geometry = periodSpanFromGeometry(numAttr(rect, "x"), numAttr(rect, "width"));
    if (!geometry) {
      warnings.push(
        `${where}: saat sütunu çözümlenemedi (x="${rect.attribs?.x}" width="${rect.attribs?.width}"), kutu atlandı.`
      );
      return;
    }

    const firstPeriod = periodByIndex.get(geometry.startPeriodIndex);
    const lastPeriod = periodByIndex.get(
      geometry.startPeriodIndex + geometry.periodSpan - 1
    );
    if (!firstPeriod || !lastPeriod) {
      warnings.push(
        `${where}: kutu ${geometry.startPeriodIndex + 1}–${
          geometry.startPeriodIndex + geometry.periodSpan
        }. dönemleri kapsıyor ama bu dönemlerin saat başlığı yok, kutu atlandı.`
      );
      return;
    }

    const instructor = lines[1] ? lines[1] : null;
    const room = lines[2] ? lines[2] : null;

    rows.push({
      courseCode: title.courseCode,
      courseName: title.courseName,
      section: title.section,
      facultyCode: null,
      programName: null,
      classYear: null,
      weekday: weekdayFromRowIndex(rowIndex),
      startTime: firstPeriod.startTime,
      endTime: lastPeriod.endTime,
      room,
      instructor,
    });
  });

  if (rows.length === 0) {
    throw new TimetableStructureError("hiçbir ders kutusu okunamadı");
  }

  return { rows, warnings, periods };
}
