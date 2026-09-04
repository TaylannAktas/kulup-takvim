/**
 * Sınav programı sayfasının (`index_files/sheet001.htm`) ayrıştırılması.
 *
 * Ağ/DB erişimi yok — gerçek fixture dosyalarıyla doğrudan test edilebilsin diye
 * `server-only` import edilmiyor (akademik takvim ayrıştırıcısıyla aynı düzen).
 *
 * `faculty_code`, `exam_type` ve `term_code` tablo içeriğinde YOK; kaynak
 * URL'inden türetiliyor ve buraya parametre olarak veriliyor (DECISIONS.md).
 */
import { load } from "cheerio";
import { hashRow } from "@/lib/scrapers/shared/hash";
import type { ExamType } from "./fetch";
import {
  detectExamColumnMapping,
  normalizeCell,
  type ColumnMappingNeedsManual,
  type ResolvedColumnMapping,
} from "./column-mapping";

export type ParsedExamSession = {
  facultyCode: string;
  examType: ExamType;
  termCode: string;
  courseCode: string | null;
  courseName: string | null;
  section: string | null;
  examDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  /**
   * Satırın ham hâli. Elle sütun eşlemesi sonradan düzeltilirse kayıtlar
   * yeniden indirilmeden işlenebilsin diye HER ZAMAN dolduruluyor
   * (yeniden işleme akışı Faz 2 işi, burada sadece verisi hazırlanıyor).
   */
  rawRow: { cells: string[]; headerCells: string[] };
  sourceUrl: string;
  sourceHash: string;
};

export type ExamScheduleParseResult = {
  /** Ayrımlı birleşim (discriminated union) etiketi — bkz. `parseExamScheduleHtml`. */
  needsManualMapping: false;
  rows: ParsedExamSession[];
  warnings: string[];
  /** Eşleme yapısal tespitten mi geldi, kayıtlı elle eşlemeden mi. */
  mappingSource: "structural" | "saved";
  mapping: ResolvedColumnMapping;
  headerCells: string[];
};

export type ExamScheduleContext = {
  facultyCode: string;
  examType: ExamType;
  termCode: string;
  sourceUrl: string;
};

/**
 * `DD.MM.YYYY` (ve tek haneli varyantları: `3.11.2025`) tarihini çözer.
 *
 * Akademik takvimin Türkçe uzun tarih biçiminden ("14 Eylül 2026 Pazartesi")
 * TAMAMEN farklı olduğu için bilinçli olarak ayrı bir fonksiyon; ortak
 * "akıllı" tarih ayrıştırıcı sessiz yanlış eşleme riski taşıyor (DECISIONS.md).
 */
export function parseDottedDate(raw: string): Date | null {
  const text = normalizeCell(raw);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // 31.02.2025 gibi taşan tarihleri yakala.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * `15:30` → `15:30`. Gerçek veride nokta ayraçlı saatler de var
 * (`13.30`, `16.00`) — ikisi de aynı biçime normalleştiriliyor, aksi halde
 * aynı sınav farklı hash üretir.
 */
export function parseExamTime(raw: string): string | null {
  const text = normalizeCell(raw);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * "AE111-01" → { courseCode: "AE111", section: "01" }.
 *
 * Bilinçli olarak dar bir regex: tire ZORUNLU. "CE 406" gibi sonu rakamla biten
 * ders kodları yanlışlıkla "CE 4" + "06" diye bölünmesin diye. Bölünemezse
 * section boş bırakılıyor — spesifikasyonda da beklenen davranış bu.
 *
 * Ders kodunun içindeki boşluk korunuyor ("CE 417-01" → "CE 417"): kaynaktaki
 * yazımı değiştirmek veri kaybı/karışıklığı riski taşır.
 */
export function splitCourseCode(raw: string): { courseCode: string | null; section: string | null } {
  const text = normalizeCell(raw);
  if (!text) return { courseCode: null, section: null };

  const match = text.match(/^(.+?)-(\d{1,2})$/);
  if (!match) return { courseCode: text, section: null };

  return { courseCode: match[1].trim(), section: match[2] };
}

/**
 * Sayfadaki en çok satıra sahip tabloyu bulup satır/hücre matrisine çevirir.
 * Excel çıktısında tek bir tablo var; "en çok satırlı" seçimi ileride
 * sarmalayıcı tablolar eklenirse diye güvenlik payı.
 */
export function extractTableRows(html: string): string[][] {
  const $ = load(html);
  const tables = $("table").toArray();
  if (tables.length === 0) return [];

  let best: string[][] = [];
  for (const table of tables) {
    const rows = $(table)
      .find("tr")
      .toArray()
      .map((tr) =>
        $(tr)
          .find("td, th")
          .map((_, cell) => normalizeCell($(cell).text()))
          .get()
      );
    if (rows.length > best.length) best = rows;
  }
  return best;
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => cell === "");
}

/**
 * Çözülmüş bir sütun eşlemesiyle veri satırlarını `ParsedExamSession`'a çevirir.
 *
 * Tek bir bozuk satır asla hata fırlatmaz: atlanır ve `warnings`'e yazılır.
 * Hata yalnızca tablo yapısının kendisi bulunamadığında fırlatılır.
 */
export function parseExamRows(
  rows: string[][],
  headerCells: string[],
  mapping: ResolvedColumnMapping,
  context: ExamScheduleContext
): { rows: ParsedExamSession[]; warnings: string[] } {
  const warnings: string[] = [];
  const parsed: ParsedExamSession[] = [];
  const where = `[${context.termCode}/${context.facultyCode}/${context.examType}]`;

  rows.forEach((cells, index) => {
    // Excel çıktısında başlıkla veri arasında ve tablonun sonunda tamamen boş
    // dolgu satırları var — bunlar sessizce atlanır, uyarı gürültüsü olmasın.
    if (isEmptyRow(cells)) return;

    const cellAt = (columnIndex: number | null): string =>
      columnIndex === null ? "" : (cells[columnIndex] ?? "");

    const rawCourseCode = cellAt(mapping.courseCode);
    if (!rawCourseCode) {
      warnings.push(
        `${where} satır ${index}: ders kodu hücresi boş, satır atlandı. (${cells.join(" | ")})`
      );
      return;
    }

    const { courseCode, section } = splitCourseCode(rawCourseCode);

    const rawDate = cellAt(mapping.examDate);
    const rawStart = cellAt(mapping.startTime);
    const rawEnd = cellAt(mapping.endTime);

    const examDate = parseDottedDate(rawDate);
    const startTime = parseExamTime(rawStart);
    const endTime = parseExamTime(rawEnd);

    if (rawDate && !examDate) {
      warnings.push(`${where} satır ${index}: tarih çözümlenemedi ("${rawDate}"), boş bırakıldı. (${rawCourseCode})`);
    }
    if (rawStart && !startTime) {
      warnings.push(`${where} satır ${index}: başlangıç saati çözümlenemedi ("${rawStart}"), boş bırakıldı. (${rawCourseCode})`);
    }
    if (rawEnd && !endTime) {
      warnings.push(`${where} satır ${index}: bitiş saati çözümlenemedi ("${rawEnd}"), boş bırakıldı. (${rawCourseCode})`);
    }

    const courseName = cellAt(mapping.courseName) || null;
    const room = cellAt(mapping.room) || null;

    // DİKKAT — spesifikasyondaki alan listesinden bilinçli sapma: `section`
    // de hash'e dâhil. Gerçek veride aynı dersin farklı şubeleri aynı gün,
    // aynı saatte, aynı odada sınava giriyor (örn. AE307-01/-02/-03) ve
    // section olmadan hash'leri birebir aynı çıkıyor: Mühendislik güz
    // arasınavında 298 satırın 224'e düşmesi, yani 74 kaydın sessizce
    // yutulması demek. Şube bilgisi kaydın kimliğinin parçası.
    const sourceHash = hashRow([
      context.facultyCode,
      context.examType,
      context.termCode,
      courseCode,
      section,
      examDate?.toISOString(),
      startTime,
      endTime,
      room,
    ]);

    parsed.push({
      facultyCode: context.facultyCode,
      examType: context.examType,
      termCode: context.termCode,
      courseCode,
      courseName,
      section,
      examDate,
      startTime,
      endTime,
      room,
      rawRow: { cells, headerCells },
      sourceUrl: context.sourceUrl,
      sourceHash,
    });
  });

  return { rows: parsed, warnings };
}

/**
 * Uçtan uca ayrıştırma: HTML → satırlar → sütun eşlemesi → sınav kayıtları.
 *
 * `savedMapping` verilirse yapısal tespit denenmez (elle eşleme her zaman
 * üstündür). Yapısal tespit başarısız olur ve kayıtlı eşleme de yoksa
 * `needsManualMapping` sonucu OLDUĞU GİBİ döndürülür — çağıran taraf
 * `sync_runs.status = "needs_mapping"` yazıp durur, hiçbir satır yazılmaz.
 */
export function parseExamScheduleHtml(
  html: string,
  context: ExamScheduleContext,
  savedMapping?: { columns: ResolvedColumnMapping; headerRowIndex?: number } | null
): ExamScheduleParseResult | ColumnMappingNeedsManual {
  const tableRows = extractTableRows(html);

  if (tableRows.length === 0) {
    throw new Error(
      `Sınav programı sayfasında tablo bulunamadı (${context.sourceUrl}). Kaynak sayfanın yapısı değişmiş olabilir.`
    );
  }

  if (savedMapping) {
    const headerRowIndex = savedMapping.headerRowIndex;
    const headerCells =
      headerRowIndex !== undefined && tableRows[headerRowIndex] ? tableRows[headerRowIndex] : [];
    const dataRows =
      headerRowIndex === undefined ? tableRows : tableRows.slice(headerRowIndex + 1);

    const { rows, warnings } = parseExamRows(dataRows, headerCells, savedMapping.columns, context);
    return {
      needsManualMapping: false,
      rows,
      warnings,
      mappingSource: "saved",
      mapping: savedMapping.columns,
      headerCells,
    };
  }

  const detection = detectExamColumnMapping(tableRows);
  if (detection.needsManualMapping) return detection;

  const dataRows = tableRows.slice(detection.headerRowIndex + 1);
  const { rows, warnings } = parseExamRows(
    dataRows,
    detection.headerCells,
    detection.mapping,
    context
  );

  return {
    needsManualMapping: false,
    rows,
    warnings: [...detection.warnings, ...warnings],
    mappingSource: "structural",
    mapping: detection.mapping,
    headerCells: detection.headerCells,
  };
}
