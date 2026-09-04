/**
 * Sınav programı tablosunun sütun eşlemesi.
 *
 * Kaynak, Excel'den elle üretilen bir HTML dökümü. Sütun sırasının dönemden
 * döneme değişebileceği spesifikasyonda uyarı olarak geçiyor (DECISIONS.md'de
 * incelenen iki fakültede aynıydı, ama şablon her yıl elle hazırlanıyor).
 * Bu yüzden sütunlar **sabit indekslerle değil, başlık metnine bakılarak**
 * bulunuyor. Eşleme yapılamazsa tahmin yürütülmüyor: `needsManualMapping`
 * dönüp elle eşlemeye (Faz 2 paneli) devrediliyor.
 *
 * Bu dosya ayrıştırma tarafında saf tutuldu; `server-only` ve veritabanı
 * erişimi yalnızca dosyanın sonundaki `source_column_mapping` sorgularında
 * kullanılıyor ve o import'lar test ortamında (vitest alias'ı) zararsız.
 */
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceColumnMapping } from "@/lib/db/schema";
import { foldTurkish } from "@/config/calendar-classification";
import { EXAM_SCHEDULE_HOST } from "./fetch";

export type ExamColumnField =
  | "courseCode"
  | "courseName"
  | "room"
  | "examDate"
  | "startTime"
  | "endTime";

/** Bunlar olmadan satır anlamlı bir sınav kaydına dönüşemez. */
export const REQUIRED_FIELDS: ExamColumnField[] = [
  "courseCode",
  "examDate",
  "startTime",
  "endTime",
];

/** Bulunursa kullanılır, bulunamazsa `null` bırakılır — eşlemeyi düşürmez. */
export const OPTIONAL_FIELDS: ExamColumnField[] = ["courseName", "room"];

/**
 * Başlık hücresi anahtar kelimeleri. Karşılaştırma `foldTurkish` ile
 * sadeleştirilmiş (Türkçe karakterler ASCII'ye indirgenmiş, küçük harfli,
 * boşlukları tekilleştirilmiş) metin üzerinde `includes` ile yapılıyor;
 * bu yüzden anahtarlar da sade yazılmalı ("dersin adi", "dersin adı" değil).
 *
 * Gerçek başlıklar iki dilli ve satır içi `<br>` ile bölünmüş
 * ("Başlangıç<br>Saati<br>Start Time") — normalleştirme sonrası
 * "baslangic saati start time" hâline geliyor.
 */
export const COLUMN_KEYWORDS: Record<ExamColumnField, string[]> = {
  courseCode: ["ders kodu", "course code"],
  courseName: ["dersin adi", "course name", "ders adi"],
  room: ["sinif", "classroom", "derslik"],
  examDate: ["tarih", "date"],
  startTime: ["baslangic", "start time", "baslama"],
  endTime: ["bitis", "end time"],
};

/** Çözülmüş eşleme: zorunlu alanlar sayı, isteğe bağlı alanlar `null` olabilir. */
export type ResolvedColumnMapping = {
  courseCode: number;
  examDate: number;
  startTime: number;
  endTime: number;
  courseName: number | null;
  room: number | null;
};

export type ColumnMappingSuccess = {
  needsManualMapping: false;
  mapping: ResolvedColumnMapping;
  /** Veri satırları bu indeksten *sonra* başlar. */
  headerRowIndex: number;
  headerCells: string[];
  /** Eşleme nereden geldi: yapısal tespit mi, kayıtlı elle eşleme mi. */
  source: "structural" | "saved";
  warnings: string[];
};

export type ColumnMappingNeedsManual = {
  needsManualMapping: true;
  reason: string;
  /** En çok alan eşleşen satır (hiçbiri eşleşmediyse `null`). */
  headerRowIndex: number | null;
  /** Elle eşleme ekranına gösterilecek ham başlık hücreleri. */
  headerCells: string[];
  /** Ham veri satırları — yeniden indirmeden elle eşleme yapılabilsin diye korunuyor. */
  dataRows: string[][];
  warnings: string[];
};

export type ColumnMappingResult = ColumnMappingSuccess | ColumnMappingNeedsManual;

/** `&nbsp;` ve satır sonları dâhil tüm boşlukları tek boşluğa indirir. */
export function normalizeCell(raw: string): string {
  return raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Tek bir başlık hücresinin bir alana ne kadar iyi uyduğu.
 * Puan = eşleşen en uzun anahtar kelimenin uzunluğu. Böylece daha özel
 * ("course code", 11) ifade daha genel olana ("date", 4) üstün gelir.
 */
export function scoreHeaderCell(cell: string, field: ExamColumnField): number {
  const folded = foldTurkish(normalizeCell(cell));
  if (!folded) return 0;

  let best = 0;
  for (const keyword of COLUMN_KEYWORDS[field]) {
    const needle = foldTurkish(keyword);
    if (needle && folded.includes(needle) && needle.length > best) {
      best = needle.length;
    }
  }
  return best;
}

type FieldResolution =
  | { kind: "ok"; index: number }
  | { kind: "none" }
  | { kind: "ambiguous"; indexes: number[] };

function resolveField(headerCells: string[], field: ExamColumnField): FieldResolution {
  const scored = headerCells
    .map((cell, index) => ({ index, score: scoreHeaderCell(cell, field) }))
    .filter((entry) => entry.score > 0);

  if (scored.length === 0) return { kind: "none" };

  const best = Math.max(...scored.map((entry) => entry.score));
  const winners = scored.filter((entry) => entry.score === best);

  // Aynı puanla birden fazla sütun eşleştiyse hangisi olduğunu bilemeyiz.
  // Yanlış sütunu sessizce seçmektense elle eşlemeye devrediyoruz.
  if (winners.length > 1) return { kind: "ambiguous", indexes: winners.map((w) => w.index) };

  return { kind: "ok", index: winners[0].index };
}

type HeaderAttempt = {
  mapping: ResolvedColumnMapping | null;
  matchedFieldCount: number;
  problems: string[];
};

/** Tek bir satırı başlık satırı varsayarak eşlemeyi dener. */
function tryHeaderRow(headerCells: string[]): HeaderAttempt {
  const problems: string[] = [];
  const resolved: Partial<Record<ExamColumnField, number | null>> = {};
  let matchedFieldCount = 0;
  let requiredOk = true;

  for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
    const outcome = resolveField(headerCells, field);
    const isRequired = REQUIRED_FIELDS.includes(field);

    if (outcome.kind === "ok") {
      resolved[field] = outcome.index;
      matchedFieldCount += 1;
      continue;
    }

    if (outcome.kind === "ambiguous") {
      problems.push(
        `"${field}" alanı için ${outcome.indexes.length} sütun aynı güvenle eşleşti (indeksler: ${outcome.indexes.join(", ")}), tahmin yürütülmedi.`
      );
      if (isRequired) requiredOk = false;
      resolved[field] = null;
      continue;
    }

    if (isRequired) {
      problems.push(`Zorunlu "${field}" sütunu başlık satırında bulunamadı.`);
      requiredOk = false;
    }
    resolved[field] = null;
  }

  // Aynı sütun iki zorunlu alana birden düşerse eşleme güvenilir değildir.
  const usedIndexes = REQUIRED_FIELDS.map((field) => resolved[field]).filter(
    (index): index is number => typeof index === "number"
  );
  if (new Set(usedIndexes).size !== usedIndexes.length) {
    problems.push("Aynı sütun birden fazla zorunlu alana eşleşti, eşleme güvenilir değil.");
    requiredOk = false;
  }

  if (!requiredOk) return { mapping: null, matchedFieldCount, problems };

  return {
    mapping: {
      courseCode: resolved.courseCode as number,
      examDate: resolved.examDate as number,
      startTime: resolved.startTime as number,
      endTime: resolved.endTime as number,
      courseName: resolved.courseName ?? null,
      room: resolved.room ?? null,
    },
    matchedFieldCount,
    problems,
  };
}

/**
 * Tablo satırlarında başlık satırını bulur ve sütun eşlemesini çıkarır.
 *
 * Başlık satırı sabit bir indekste değil: gerçek dosyalarda önce üniversite
 * adı ve fakülte/dönem başlığı satırları geliyor (başlık 3. indekste).
 * Bu yüzden "her satırı başlık gibi dene, ilk tutan kazanır" yaklaşımı
 * kullanılıyor.
 */
export function detectExamColumnMapping(rows: string[][]): ColumnMappingResult {
  if (rows.length === 0) {
    return {
      needsManualMapping: true,
      reason: "Tabloda hiç satır yok.",
      headerRowIndex: null,
      headerCells: [],
      dataRows: [],
      warnings: [],
    };
  }

  let bestPartial: { index: number; attempt: HeaderAttempt } | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const attempt = tryHeaderRow(rows[index]);

    if (attempt.mapping) {
      const warnings = attempt.problems.map(
        (problem) => `Başlık satırı ${index}: ${problem}`
      );
      return {
        needsManualMapping: false,
        mapping: attempt.mapping,
        headerRowIndex: index,
        headerCells: rows[index],
        source: "structural",
        warnings,
      };
    }

    if (!bestPartial || attempt.matchedFieldCount > bestPartial.attempt.matchedFieldCount) {
      bestPartial = { index, attempt };
    }
  }

  const headerRowIndex =
    bestPartial && bestPartial.attempt.matchedFieldCount > 0 ? bestPartial.index : null;

  return {
    needsManualMapping: true,
    reason:
      bestPartial && bestPartial.attempt.problems.length
        ? `Sütun eşlemesi yapılamadı. En yakın aday satır ${bestPartial.index}: ${bestPartial.attempt.problems.join(" ")}`
        : "Sütun eşlemesi yapılamadı: hiçbir satır başlık satırına benzemiyor.",
    headerRowIndex,
    headerCells: headerRowIndex === null ? [] : rows[headerRowIndex],
    dataRows: headerRowIndex === null ? rows : rows.slice(headerRowIndex + 1),
    warnings: [],
  };
}

/* ------------------------------------------------------------------ */
/* Kayıtlı (elle yapılmış) eşlemeler — source_column_mapping tablosu    */
/* ------------------------------------------------------------------ */

/**
 * `source_column_mapping.mapping` sütununda saklanan biçim.
 * `headerRowIndex` isteğe bağlı: verilirse o satıra kadar olanlar atlanır,
 * verilmezse tüm satırlar veri satırı olarak denenir (ayrıştırıcı zaten
 * ders kodu boş olan satırları atlıyor).
 */
export type StoredExamColumnMapping = {
  kind: "exam-schedule";
  columns: ResolvedColumnMapping;
  headerRowIndex?: number;
};

/**
 * Kayıtlı eşleme aranırken kullanılan iki desen.
 *
 * KARAR: hem tam URL hem de fakülte bazlı genel desen destekleniyor, önce tam
 * eşleşme deneniyor. Gerekçe: Excel şablonu her dönem elle hazırlandığı için
 * bozukluk genelde tek bir dönem/fakülte sayfasına özgü oluyor (tam desen),
 * ama bir fakülte kendi şablonunu kalıcı olarak farklı tutuyorsa her dönem
 * yeniden elle eşleme yapmak zorunda kalınmasın diye genel desen de var.
 */
export function exactUrlPattern(rootUrl: string): string {
  return rootUrl.replace(/\/+$/, "").toLowerCase();
}

export function facultyUrlPattern(facultyCode: string): string {
  return `${EXAM_SCHEDULE_HOST}/*/${facultyCode.toLowerCase()}`;
}

function isStoredMapping(value: unknown): value is StoredExamColumnMapping {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredExamColumnMapping>;
  if (candidate.kind !== "exam-schedule") return false;
  const columns = candidate.columns;
  if (typeof columns !== "object" || columns === null) return false;
  return REQUIRED_FIELDS.every(
    (field) => typeof (columns as Record<string, unknown>)[field] === "number"
  );
}

/**
 * Bu kaynak için daha önce elle kaydedilmiş bir sütun eşlemesi arar.
 * Önce tam URL deseni, yoksa fakülte bazlı genel desen; her ikisinde de
 * en yeni kayıt kazanır.
 */
export async function findSavedColumnMapping(
  rootUrl: string,
  facultyCode: string
): Promise<StoredExamColumnMapping | null> {
  const exact = exactUrlPattern(rootUrl);
  const general = facultyUrlPattern(facultyCode);

  const candidates = await db
    .select()
    .from(sourceColumnMapping)
    .where(inArray(sourceColumnMapping.sourceUrlPattern, [exact, general]))
    .orderBy(desc(sourceColumnMapping.createdAt));

  for (const pattern of [exact, general]) {
    const hit = candidates.find((row) => row.sourceUrlPattern === pattern);
    if (hit && isStoredMapping(hit.mapping)) return hit.mapping;
  }
  return null;
}

/** Elle yapılmış bir eşlemeyi kaydeder (Faz 2 paneli bunu çağıracak). */
export async function saveColumnMapping(params: {
  sourceUrlPattern: string;
  mapping: StoredExamColumnMapping;
  createdBy?: string | null;
}) {
  const [saved] = await db
    .insert(sourceColumnMapping)
    .values({
      sourceUrlPattern: params.sourceUrlPattern,
      mapping: params.mapping,
      createdBy: params.createdBy ?? null,
    })
    .returning();
  return saved;
}

/** Belirli bir desene ait kayıtlı eşlemeyi siler (yanlış eşleme geri alınabilsin diye). */
export async function deleteColumnMapping(id: string) {
  await db.delete(sourceColumnMapping).where(eq(sourceColumnMapping.id, id));
}
