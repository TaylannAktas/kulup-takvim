import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverExamScheduleLinks,
  findSheetFrameSrc,
  parseExamScheduleUrl,
} from "@/lib/scrapers/exam-schedule/fetch";
import {
  detectExamColumnMapping,
  scoreHeaderCell,
} from "@/lib/scrapers/exam-schedule/column-mapping";
import {
  extractTableRows,
  parseDottedDate,
  parseExamScheduleHtml,
  parseExamTime,
  splitCourseCode,
  type ExamScheduleParseResult,
  type ParsedExamSession,
} from "@/lib/scrapers/exam-schedule/parse";
import { resolveUrl } from "@/lib/scrapers/shared/http-client";

/**
 * Gerçek (canlı siteden indirilmiş) fixture'larla ayrıştırıcı testleri.
 * Ağ erişimi yok; dosyalar `node:fs` ile okunuyor.
 *
 * Beklenen değerler fixture'lardan elle doğrulandı:
 *  - başlık satırı `sheet001-muh-guzarasinav.html` içinde 3. satır (0 tabanlı),
 *    veri satırları 4'ten itibaren;
 *  - tabloda solda 2, sağda 2 boş "dolgu" sütunu var, bu yüzden ders kodu
 *    sütunu 0. değil 2. indekste.
 */

const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/exam-schedule/", import.meta.url));

function fixture(name: string): string {
  return readFileSync(`${FIXTURE_DIR}${name}`, "utf8");
}

const MUH_ROOT_URL = "https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/muh";

const MUH_CONTEXT = {
  facultyCode: "muh",
  examType: "arasinav" as const,
  termCode: "20252026guz",
  sourceUrl: `${MUH_ROOT_URL}/index_files/sheet001.htm`,
};

/** Testte tip daraltma yapmak yerine tek yerde "eşleme başarılı olmalı" diyoruz. */
function expectParsed(
  result: ReturnType<typeof parseExamScheduleHtml>
): ExamScheduleParseResult {
  if (result.needsManualMapping) {
    throw new Error(`Beklenmedik şekilde elle eşleme istendi: ${result.reason}`);
  }
  return result;
}

function findRow(rows: ParsedExamSession[], courseCode: string, examDateIso: string) {
  const hit = rows.find(
    (row) => row.courseCode === courseCode && row.examDate?.toISOString() === examDateIso
  );
  if (!hit) throw new Error(`Fixture'da beklenen satır bulunamadı: ${courseCode} @ ${examDateIso}`);
  return hit;
}

describe("frameset çözümleme", () => {
  const framesetHtml = fixture("frameset-root-muh.html");

  it("frSheet çerçevesinin src'sini bulur", () => {
    expect(findSheetFrameSrc(framesetHtml)).toBe("index_files/sheet001.htm");
  });

  it("çerçeve yolunu kök URL'e göre mutlak URL'e çözer", () => {
    const src = findSheetFrameSrc(framesetHtml);
    expect(src).not.toBeNull();
    expect(resolveUrl(`${MUH_ROOT_URL}/`, src as string)).toBe(
      "https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/muh/index_files/sheet001.htm"
    );
  });

  it("script içindeki 'frSheet' dizesine kanmaz, gerçek frame'i döndürür", () => {
    // Kök sayfanın <script> bloğu da frameset kuruyor; regex tabanlı bir çözüm
    // oradaki dizeyi yakalardı. Beklenen değer statik <frame>'in src'si.
    expect(framesetHtml).toContain('name=\\"frSheet\\"'); // script içindeki kopya
    expect(findSheetFrameSrc(framesetHtml)).toBe("index_files/sheet001.htm");
  });
});

describe("yapısal sütun tespiti (gerçek fixture)", () => {
  it("Mühendislik fixture'ında başlığı 3. satırda bulur ve sütunları doğru eşler", () => {
    const rows = extractTableRows(fixture("sheet001-muh-guzarasinav.html"));
    const result = detectExamColumnMapping(rows);

    expect(result.needsManualMapping).toBe(false);
    if (result.needsManualMapping) return;

    expect(result.headerRowIndex).toBe(3);
    expect(result.source).toBe("structural");
    expect(result.headerCells[2]).toBe("Ders Kodu/Course Code");
    expect(result.mapping).toEqual({
      courseCode: 2,
      courseName: 3,
      room: 4,
      examDate: 5,
      startTime: 6,
      endTime: 7,
    });
  });

  it("İşletme fixture'ında da aynı eşlemeyi üretir", () => {
    const rows = extractTableRows(fixture("sheet001-isletme-guzarasinav.html"));
    const result = detectExamColumnMapping(rows);

    expect(result.needsManualMapping).toBe(false);
    if (result.needsManualMapping) return;

    expect(result.headerRowIndex).toBe(3);
    expect(result.mapping).toEqual({
      courseCode: 2,
      courseName: 3,
      room: 4,
      examDate: 5,
      startTime: 6,
      endTime: 7,
    });
  });

  it("iki dilli / <br> ile bölünmüş başlıkları puanlar", () => {
    // cheerio .text() sonrası "Başlangıç\n Saati\n Start Time" böyle geliyor.
    expect(scoreHeaderCell("Başlangıç Saati Start Time", "startTime")).toBeGreaterThan(0);
    expect(scoreHeaderCell("Başlangıç Saati Start Time", "endTime")).toBe(0);
    expect(scoreHeaderCell("Ders Kodu/Course Code", "courseCode")).toBeGreaterThan(0);
    // "Ders Kodu/Course Code" ders ADI sütunuyla karıştırılmamalı.
    expect(scoreHeaderCell("Ders Kodu/Course Code", "courseName")).toBe(0);
    expect(scoreHeaderCell("Dersin Adı/Course Name", "courseCode")).toBe(0);
  });
});

describe("tarih / saat / ders kodu yardımcıları", () => {
  it("DD.MM.YYYY ve D.M.YYYY tarihlerini çözer", () => {
    expect(parseDottedDate("31.10.2025")?.toISOString()).toBe("2025-10-31T00:00:00.000Z");
    expect(parseDottedDate("3.11.2025")?.toISOString()).toBe("2025-11-03T00:00:00.000Z");
    expect(parseDottedDate("")).toBeNull();
    expect(parseDottedDate("14 Eylül 2026 Pazartesi")).toBeNull();
    expect(parseDottedDate("31.02.2025")).toBeNull();
  });

  it("iki nokta ve nokta ayraçlı saatleri aynı biçime getirir", () => {
    expect(parseExamTime("15:30")).toBe("15:30");
    expect(parseExamTime("13.30")).toBe("13:30");
    expect(parseExamTime("9:05")).toBe("09:05");
    expect(parseExamTime("25:00")).toBeNull();
    expect(parseExamTime("")).toBeNull();
  });

  it("ders kodunu yalnızca açık tire varsa böler", () => {
    expect(splitCourseCode("AE111-01")).toEqual({ courseCode: "AE111", section: "01" });
    expect(splitCourseCode("CE 417-01")).toEqual({ courseCode: "CE 417", section: "01" });
    // Sonu rakamla biten ama section'ı olmayan kod bölünmemeli.
    expect(splitCourseCode("CE 406")).toEqual({ courseCode: "CE 406", section: null });
    expect(splitCourseCode("")).toEqual({ courseCode: null, section: null });
  });
});

describe("gerçek fixture ayrıştırma (Mühendislik, 2025-2026 güz arasınav)", () => {
  const parsed = expectParsed(
    parseExamScheduleHtml(fixture("sheet001-muh-guzarasinav.html"), MUH_CONTEXT)
  );

  it("başlık ve dolgu satırlarını atlayıp sadece veri satırlarını üretir", () => {
    expect(parsed.mappingSource).toBe("structural");
    expect(parsed.rows.length).toBe(298);
    expect(parsed.warnings).toEqual([]);
  });

  it("aynı dersin farklı şubeleri ayrı kayıt kalır (hash'e section dâhil)", () => {
    // AE307-01/-02/-03 aynı gün, aynı saat, aynı odada sınava giriyor.
    // section hash'e girmeseydi üçü tek kayda çökerdi.
    const ae307 = parsed.rows.filter((row) => row.courseCode === "AE307");
    expect(ae307.map((row) => row.section).sort()).toEqual(["01", "01", "02", "02", "03", "03"]);
    expect(new Set(ae307.map((row) => row.sourceHash)).size).toBe(6);
  });

  it("ilk satırı (AE111-01) birebir doğru ayrıştırır", () => {
    const row = parsed.rows[0];
    expect(row.courseCode).toBe("AE111");
    expect(row.section).toBe("01");
    expect(row.courseName).toBe("Otomotiv Mühendisliğinin Temelleri I.midterm");
    expect(row.room).toBe("2027");
    expect(row.examDate?.toISOString()).toBe("2025-10-31T00:00:00.000Z");
    expect(row.startTime).toBe("15:30");
    expect(row.endTime).toBe("17:20");
    expect(row.facultyCode).toBe("muh");
    expect(row.examType).toBe("arasinav");
    expect(row.termCode).toBe("20252026guz");
  });

  it("tire içermeyen ders kodunda (CE 406) section'ı boş bırakır", () => {
    const row = findRow(parsed.rows, "CE 406", "2025-11-18T00:00:00.000Z");
    expect(row.section).toBeNull();
    expect(row.courseName).toBe("Urban Hydraulics");
    expect(row.room).toBe("9");
    expect(row.startTime).toBe("09:30");
    expect(row.endTime).toBe("11:30");
  });

  it("nokta ayraçlı saatleri normalleştirir (CE 417-01: 13.30 / 16.00)", () => {
    const row = findRow(parsed.rows, "CE 417", "2025-11-12T00:00:00.000Z");
    expect(row.section).toBe("01");
    expect(row.courseName).toBe("Rock Mechanics");
    expect(row.startTime).toBe("13:30");
    expect(row.endTime).toBe("16:00");
  });

  it("çok odalı satırlarda oda listesini tek metin olarak saklar", () => {
    const row = findRow(parsed.rows, "AE307", "2025-10-25T00:00:00.000Z");
    expect(row.room).toBe("1024, 1029, B1006, B1008, B1010, B1037");
    expect(row.courseName).toBe("Akışkanlar Mekaniği I.midterm");
    expect(row.startTime).toBe("13:30");
  });

  it("her satırda ham hücreleri (raw_row) saklar — sonradan yeniden eşleme için", () => {
    for (const row of parsed.rows) {
      expect(Array.isArray(row.rawRow.cells)).toBe(true);
      expect(row.rawRow.cells.length).toBeGreaterThan(0);
      expect(row.rawRow.headerCells[2]).toBe("Ders Kodu/Course Code");
    }
  });

  it("sourceHash aynı içerik için kararlı, farklı içerik için farklıdır", () => {
    const again = expectParsed(
      parseExamScheduleHtml(fixture("sheet001-muh-guzarasinav.html"), MUH_CONTEXT)
    );
    expect(again.rows[0].sourceHash).toBe(parsed.rows[0].sourceHash);
    expect(again.rows[1].sourceHash).not.toBe(parsed.rows[0].sourceHash);

    // Aynı satır farklı fakülte/dönem bağlamında farklı hash üretmeli.
    const otherContext = expectParsed(
      parseExamScheduleHtml(fixture("sheet001-muh-guzarasinav.html"), {
        ...MUH_CONTEXT,
        examType: "final" as const,
      })
    );
    expect(otherContext.rows[0].sourceHash).not.toBe(parsed.rows[0].sourceHash);
  });
});

describe("gerçek fixture ayrıştırma (İşletme)", () => {
  it("farklı fakültede de doğru satır üretir", () => {
    const parsed = expectParsed(
      parseExamScheduleHtml(fixture("sheet001-isletme-guzarasinav.html"), {
        facultyCode: "isletme",
        examType: "arasinav",
        termCode: "20252026guz",
        sourceUrl:
          "https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/isletme/index_files/sheet001.htm",
      })
    );

    const row = parsed.rows[0];
    expect(row.courseCode).toBe("ECON101");
    expect(row.section).toBe("01");
    expect(row.courseName).toBe("İktisada Giriş I");
    expect(row.room).toBe("113İB, Z13İB");
    expect(row.examDate?.toISOString()).toBe("2025-11-17T00:00:00.000Z");
    expect(row.startTime).toBe("17:30");
    expect(row.endTime).toBe("19:30");
    expect(row.facultyCode).toBe("isletme");
  });
});

/* ------------------------------------------------------------------ */
/* Sentetik senaryolar                                                 */
/* ------------------------------------------------------------------ */

function syntheticTable(headerCells: string[], dataRows: string[][]): string {
  const tr = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  return `<html><body><table>${tr(headerCells)}${dataRows.map(tr).join("")}</table></body></html>`;
}

describe("sentetik: sütun sırası değişmiş tablo", () => {
  // DECISIONS.md: gerçek bir "sütun sırası farklı" örneği kaynakta henüz
  // bulunamadı. Sabit indeks yerine başlık metnine göre eşleme yapmanın tüm
  // değeri bu senaryoda; o yüzden sentetik olarak kurulup test ediliyor.
  // Sıra: Tarih | Bitiş Saati | Dersin Adı | Ders Kodu | Başlangıç Saati | Sınıf
  const html = syntheticTable(
    [
      "Tarih/Date",
      "Bitiş Saati<br>End Time",
      "Dersin<br>Adı/Course Name",
      "Ders Kodu/Course<br>Code",
      "Başlangıç<br>Saati<br>Start Time",
      "Sınıf/Classroom",
    ],
    [["05.12.2025", "12:00", "Veri Yapıları", "SE201-03", "10:00", "1015"]]
  );

  it("sütunları sırasına değil başlık metnine göre eşler", () => {
    const result = detectExamColumnMapping(extractTableRows(html));
    expect(result.needsManualMapping).toBe(false);
    if (result.needsManualMapping) return;

    expect(result.mapping).toEqual({
      examDate: 0,
      endTime: 1,
      courseName: 2,
      courseCode: 3,
      startTime: 4,
      room: 5,
    });
  });

  it("değişik sırayla da satırı doğru okur", () => {
    const parsed = expectParsed(parseExamScheduleHtml(html, MUH_CONTEXT));
    expect(parsed.rows).toHaveLength(1);
    const row = parsed.rows[0];
    expect(row.courseCode).toBe("SE201");
    expect(row.section).toBe("03");
    expect(row.courseName).toBe("Veri Yapıları");
    expect(row.room).toBe("1015");
    expect(row.examDate?.toISOString()).toBe("2025-12-05T00:00:00.000Z");
    expect(row.startTime).toBe("10:00");
    expect(row.endTime).toBe("12:00");
  });
});

describe("sentetik: zorunlu sütun eksik", () => {
  // Tarih sütunu yok → tahmin yürütmek yerine elle eşlemeye devredilmeli.
  const html = syntheticTable(
    [
      "Ders Kodu/Course Code",
      "Dersin Adı/Course Name",
      "Sınıf/Classroom",
      "Başlangıç Saati Start Time",
      "Bitiş Saati End Time",
    ],
    [
      ["SE201-03", "Veri Yapıları", "1015", "10:00", "12:00"],
      ["SE202-01", "Algoritmalar", "1016", "13:00", "15:00"],
    ]
  );

  it("çökmeden needsManualMapping döner ve ham satırları korur", () => {
    const result = detectExamColumnMapping(extractTableRows(html));
    expect(result.needsManualMapping).toBe(true);
    if (!result.needsManualMapping) return;

    expect(result.reason).toContain("examDate");
    expect(result.headerCells).toContain("Ders Kodu/Course Code");
    expect(result.dataRows).toHaveLength(2);
    expect(result.dataRows[0][0]).toBe("SE201-03");
  });

  it("parseExamScheduleHtml de aynı sonucu iletir (veri uydurmaz)", () => {
    const result = parseExamScheduleHtml(html, MUH_CONTEXT);
    expect(result.needsManualMapping).toBe(true);
  });

  it("kayıtlı elle eşleme verilirse aynı HTML ayrıştırılabilir", () => {
    // `source_column_mapping` tablosundan gelecek eşlemenin taklidi:
    // tarih sütunu yok, `examDate` bilinçli olarak var olmayan bir indekse
    // değil, başlıksız da olsa gerçek veri sütununa işaret ediyor olsaydı
    // burada verilirdi. Bu testte tarih gerçekten yok, o yüzden boş kalıyor.
    const parsed = expectParsed(
      parseExamScheduleHtml(html, MUH_CONTEXT, {
        columns: {
          courseCode: 0,
          courseName: 1,
          room: 2,
          startTime: 3,
          endTime: 4,
          examDate: 99,
        },
        headerRowIndex: 0,
      })
    );

    expect(parsed.mappingSource).toBe("saved");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].courseCode).toBe("SE201");
    expect(parsed.rows[0].examDate).toBeNull();
    expect(parsed.rows[0].startTime).toBe("10:00");
  });
});

describe("sentetik: bozuk tek satır tüm ayrıştırmayı düşürmez", () => {
  it("kötü tarihli satır uyarıyla geçilir, diğer satırlar kalır", () => {
    const html = syntheticTable(
      [
        "Ders Kodu/Course Code",
        "Dersin Adı/Course Name",
        "Sınıf/Classroom",
        "Tarih/Date",
        "Başlangıç Saati Start Time",
        "Bitiş Saati End Time",
      ],
      [
        ["SE201-03", "Veri Yapıları", "1015", "belirsiz", "10:00", "12:00"],
        ["SE202-01", "Algoritmalar", "1016", "06.12.2025", "13:00", "15:00"],
      ]
    );

    const parsed = expectParsed(parseExamScheduleHtml(html, MUH_CONTEXT));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].examDate).toBeNull();
    expect(parsed.warnings.join(" ")).toContain("tarih çözümlenemedi");
    expect(parsed.rows[1].examDate?.toISOString()).toBe("2025-12-06T00:00:00.000Z");
  });

  it("tablo hiç yoksa hata fırlatır", () => {
    expect(() => parseExamScheduleHtml("<html><body><p>yok</p></body></html>", MUH_CONTEXT)).toThrow(
      /tablo bulunamadı/
    );
  });
});

/* ------------------------------------------------------------------ */
/* Keşif sayfası                                                       */
/* ------------------------------------------------------------------ */

describe("keşif sayfası ayrıştırma", () => {
  const links = discoverExamScheduleLinks(
    fixture("dersprogrami-discovery-index.html"),
    "https://www.atilim.edu.tr/tr/dersprogrami"
  );

  it("gerçek bağlantılardan doğru {termCode, examType, facultyCode, url} üretir", () => {
    const expected = [
      {
        termCode: "20252026guz",
        examType: "arasinav",
        facultyCode: "muh",
        url: "https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/muh",
      },
      {
        termCode: "20252026guz",
        examType: "arasinav",
        facultyCode: "isletme",
        url: "https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/isletme",
      },
      {
        termCode: "20252026guz",
        examType: "final",
        facultyCode: "fef",
        url: "https://dersprogramiyukle.atilim.edu.tr/20252026guzfinal/fef",
      },
      {
        termCode: "20252026guz",
        examType: "mazeret",
        facultyCode: "servis",
        url: "https://dersprogramiyukle.atilim.edu.tr/20252026guzmazeret/servis",
      },
      {
        termCode: "20252026bahar",
        examType: "arasinav",
        facultyCode: "etp",
        url: "https://dersprogramiyukle.atilim.edu.tr/20252026bahararasinav/etp",
      },
      {
        termCode: "20242025bahar",
        examType: "final",
        facultyCode: "shmyo",
        url: "https://dersprogramiyukle.atilim.edu.tr/20242025baharfinal/shmyo",
      },
    ];

    for (const item of expected) {
      expect(links).toContainEqual(item);
    }
    expect(links.length).toBeGreaterThanOrEqual(expected.length);
  });

  it("tür/dönem sırası ters yazılmış eski bağlantıları da aynı termCode'a indirger", () => {
    // ".../20232024arasinavbahar/muh" → dönem 20232024bahar, tür arasinav
    expect(links).toContainEqual({
      termCode: "20232024bahar",
      examType: "arasinav",
      facultyCode: "muh",
      url: "https://dersprogramiyukle.atilim.edu.tr/20232024arasinavbahar/muh",
    });
  });

  it("sınav içermeyen ders programı bağlantılarını ve bilinmeyen fakülteleri eler", () => {
    // "20252026guz/pilotaj" ders programı, sınav programı değil.
    expect(parseExamScheduleUrl("https://dersprogramiyukle.atilim.edu.tr/20252026guz/pilotaj")).toBeNull();
    // Tanınmayan fakülte kısaltması (eski dönem).
    expect(
      parseExamScheduleUrl("https://dersprogramiyukle.atilim.edu.tr/20232024guzarasinav/muhendislik")
    ).toBeNull();
    // Başka host.
    expect(parseExamScheduleUrl("https://www.atilim.edu.tr/tr/dersprogrami")).toBeNull();
    // Fazla derin yol.
    expect(
      parseExamScheduleUrl(
        "https://dersprogramiyukle.atilim.edu.tr/20212022bahar/final_bahar_202122/isletme"
      )
    ).toBeNull();

    expect(links.every((link) => link.url.includes("dersprogramiyukle.atilim.edu.tr"))).toBe(true);
  });

  it("aynı hedefe giden yinelenen bağlantıları teke indirir", () => {
    const urls = links.map((link) => link.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
