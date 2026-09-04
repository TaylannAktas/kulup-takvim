import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  dayRowIndex,
  extractPeriods,
  parseEdupageTimetableSvg,
  parseTimeRangeLabel,
  periodSpanFromGeometry,
  splitSessionTitle,
  stripEdgeWhitespace,
  TimetableStructureError,
  type ParsedCourseSession,
} from "@/lib/timetable-import/parse-svg-timetable";

/**
 * Gerçek (kullanıcının tarayıcısından "Web Sayfası, Tamamı" ile kaydettiği)
 * fixture ile ayrıştırıcı testleri. Ağ ve DB erişimi yok.
 */
const fixtureUrl = new URL(
  "../../../fixtures/edupage/sinif-programi-ornek.htm",
  import.meta.url
);
const html = readFileSync(fileURLToPath(fixtureUrl), "utf8");

/** Dosyadaki ders kutusu (başlıklı `<rect>`) sayısı — elle sayıldı. */
const EXPECTED_SESSION_COUNT = 21;

function find(
  rows: ParsedCourseSession[],
  predicate: (row: ParsedCourseSession) => boolean
): ParsedCourseSession {
  const match = rows.filter(predicate);
  expect(match).toHaveLength(1);
  return match[0];
}

describe("saf yardımcılar", () => {
  it("stripEdgeWhitespace bölünmez boşluğu da atar", () => {
    expect(stripEdgeWhitespace("  Tarihi-I   ")).toBe("Tarihi-I");
    expect(stripEdgeWhitespace("C103  ")).toBe("C103");
  });

  it("parseTimeRangeLabel saatleri sıfır dolgulu HH:MM'e normalleştirir", () => {
    expect(parseTimeRangeLabel("9:30 - 10:20")).toEqual({
      startTime: "09:30",
      endTime: "10:20",
    });
    expect(parseTimeRangeLabel("Staff")).toBeNull();
    expect(parseTimeRangeLabel("O-223 İlk ve Acil Yard. Lab.")).toBeNull();
  });

  it("dayRowIndex yarım satır ofsetlerinde AŞAĞI yuvarlar (round olsaydı gün kayardı)", () => {
    expect(dayRowIndex(420)).toBe(0);
    // Kutu satırın ortasında başlıyor: Math.round(4.5) = 5 olurdu → Cumartesi.
    expect(dayRowIndex(1567.5)).toBe(4);
    expect(dayRowIndex(547.5)).toBe(0);
    expect(dayRowIndex(1057.5)).toBe(2);
    expect(dayRowIndex(1695)).toBe(5);
    expect(dayRowIndex(1950)).toBeNull();
    expect(dayRowIndex(100)).toBeNull();
  });

  it("periodSpanFromGeometry genişlikten dönem sayısını çıkarır", () => {
    expect(periodSpanFromGeometry(345, 213.75)).toEqual({
      startPeriodIndex: 0,
      periodSpan: 1,
    });
    expect(periodSpanFromGeometry(345, 427.5)).toEqual({
      startPeriodIndex: 0,
      periodSpan: 2,
    });
    expect(periodSpanFromGeometry(1413.75, 641.25)).toEqual({
      startPeriodIndex: 5,
      periodSpan: 3,
    });
  });

  it("splitSessionTitle ders adı olmayan başlıkları da kabul eder", () => {
    expect(splitSessionTitle("ACL103-SEC-01-İlk ve Acil Yardım Uygulamaları I")).toEqual({
      courseCode: "ACL103",
      section: "01",
      courseName: "İlk ve Acil Yardım Uygulamaları I",
    });
    // Gerçek dosyada 4 ders böyle: kod + şube var, ad yok.
    expect(splitSessionTitle("ENG121-SEC-17")).toEqual({
      courseCode: "ENG121",
      section: "17",
      courseName: null,
    });
    expect(splitSessionTitle("rastgele metin")).toBeNull();
  });
});

describe("gerçek fixture: saat başlıkları", () => {
  const periods = extractPeriods(html);

  it("12 dönem sütunu okur", () => {
    expect(periods).toHaveLength(12);
    expect(periods.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("1. dönem 09:30 - 10:20 (ham etiket sıfır dolgusuz)", () => {
    expect(periods[0].rawLabel).toBe("9:30 - 10:20");
    expect(periods[0].startTime).toBe("09:30");
    expect(periods[0].endTime).toBe("10:20");
  });

  it("son dönem 20:30 - 21:20", () => {
    expect(periods[11].startTime).toBe("20:30");
    expect(periods[11].endTime).toBe("21:20");
  });
});

describe("gerçek fixture: ders oturumları", () => {
  const { rows, warnings } = parseEdupageTimetableSvg(html);

  it("21 ders okur ve hiç uyarı üretmez", () => {
    // `<title>` sayısı 22 görünür — biri sayfanın <head><title>'ı, ders değil.
    expect(rows).toHaveLength(EXPECTED_SESSION_COUNT);
    expect(warnings).toEqual([]);
  });

  it("kapsam dışı alanlar bilinçli olarak null (DECISIONS.md)", () => {
    for (const row of rows) {
      expect(row.facultyCode).toBeNull();
      expect(row.programName).toBeNull();
      expect(row.classYear).toBeNull();
    }
  });

  it("ACL103-SEC-01 Çarşamba 09:30–11:20 bloğu", () => {
    const row = find(
      rows,
      (r) => r.courseCode === "ACL103" && r.weekday === 3 && r.startTime === "09:30"
    );
    expect(row).toEqual({
      courseCode: "ACL103",
      courseName: "İlk ve Acil Yardım Uygulamaları I",
      section: "01",
      facultyCode: null,
      programName: null,
      classYear: null,
      weekday: 3, // Çarşamba (y=930 → satır 2)
      startTime: "09:30",
      endTime: "11:20",
      room: "O-223 İlk ve Acil Yard. Lab.",
      instructor: "Elif Önlü / Burcu Saygan Karamürsel",
    });
  });

  it("HIST101-SEC-04: ders adının sonundaki &nbsp; temizlenir, UZAKTAN odası korunur", () => {
    const row = find(rows, (r) => r.courseCode === "HIST101");
    expect(row.courseName).toBe("Atatürk İlkeleri ve İnkılâp Tarihi-I");
    expect(row.courseName).not.toMatch(/ /);
    expect(row.room).toBe("UZAKTAN");
    expect(row.instructor).toBe("Gültekin Kamil Birlik");
    expect(row.weekday).toBe(3);
    expect(row.startTime).toBe("15:30");
    expect(row.endTime).toBe("17:20");
  });

  it("ders adı olmayan ENG121 blokları atılmaz, courseName null kalır", () => {
    const eng = rows.filter((r) => r.courseCode === "ENG121");
    expect(eng).toHaveLength(4);
    for (const row of eng) {
      expect(row.courseName).toBeNull();
      expect(row.instructor).toBe("Staff");
    }
    const monday = find(rows, (r) => r.section === "17" && r.weekday === 1);
    expect(monday.room).toBe("C304");
    expect(monday.startTime).toBe("09:30");
    expect(monday.endTime).toBe("11:20");
  });

  describe("çok dönemli bloklar", () => {
    it("3 dönem (width=641.25): HIST201 Salı 09:30–12:20", () => {
      const row = find(rows, (r) => r.courseCode === "HIST201");
      expect(row.courseName).toBe("Uygarlık Tarihi");
      expect(row.weekday).toBe(2); // Salı
      expect(row.startTime).toBe("09:30"); // 1. dönem başlangıcı
      expect(row.endTime).toBe("12:20"); // 3. dönem bitişi
      expect(row.room).toBe("UZAKTAN");
    });

    it("3 dönem, sütun 6'dan başlıyor: SMYO103-SEC-01 Salı 14:30–17:20", () => {
      const row = find(
        rows,
        (r) => r.courseCode === "SMYO103" && r.section === "01" && r.weekday === 2
      );
      expect(row.startTime).toBe("14:30");
      expect(row.endTime).toBe("17:20");
      expect(row.instructor).toBe("Berna Yılmaz Şirin");
      expect(row.room).toBe("C307");
    });

    it("tek dönem (width=213.75): ACL103 Çarşamba 11:30–12:20", () => {
      const row = find(
        rows,
        (r) => r.courseCode === "ACL103" && r.startTime === "11:30"
      );
      expect(row.endTime).toBe("12:20");
      expect(row.weekday).toBe(3);
    });
  });
});

/**
 * Cuma/Cumartesi tuzağı: iki satırın da gün etiketi "Cu". Gün ETİKETİNDEN
 * değil, SATIR SIRASINDAN türetildiği için ayrım doğru yapılıyor.
 */
describe("Cuma/Cumartesi ayrımı satır sırasından yapılır", () => {
  it("fixture'da gün etiketi gerçekten iki kez 'Cu' (metin ayırt edici değil)", () => {
    expect(html.match(/>Cu</g)).toHaveLength(2);
  });

  it("satır 4'teki dersler Cuma (weekday=5) — y=1440 ve y=1567.5 aynı gün", () => {
    const { rows } = parseEdupageTimetableSvg(html);
    const friday = rows.filter((r) => r.weekday === 5);
    // Fixture'da Cuma'da 6 ders var; ikisi (y=1567.5) satırın alt yarısında.
    expect(friday).toHaveLength(6);
    // y=1567.5 olan blok: round() kullanılsaydı weekday=6 (Cumartesi) olurdu.
    const lowerHalf = find(
      rows,
      (r) => r.courseCode === "SMYO103" && r.section === "01" && r.weekday === 5
    );
    expect(lowerHalf.room).toBe("MAKET LAB.");
    expect(lowerHalf.startTime).toBe("13:30");
    expect(lowerHalf.endTime).toBe("15:20");

    // Gerçek dosyada Cumartesi'de hiç ders yok — bu yüzden 6. satır sentetik
    // olarak aşağıdaki testte doğrulanıyor.
    expect(rows.some((r) => r.weekday === 6)).toBe(false);
  });

  it("sentetik: aynı 'Cu' etiketiyle 5. satır Cumartesi (weekday=6) olur", () => {
    const synthetic = syntheticSvg(`
      <text x="202.5" y="1567.5">Cu</text>
      <text x="202.5" y="1822.5">Cu</text>
      <rect x="345" y="1440" width="213.75" height="255" fill="transparent" stroke-width="0"><title>AAA111-SEC-01-Cuma Dersi
Hoca A
C101</title></rect>
      <rect x="345" y="1695" width="213.75" height="255" fill="transparent" stroke-width="0"><title>BBB222-SEC-02-Cumartesi Dersi
Hoca B
C102</title></rect>
    `);

    const { rows, warnings } = parseEdupageTimetableSvg(synthetic);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ courseCode: "AAA111", weekday: 5 });
    expect(rows[1]).toMatchObject({ courseCode: "BBB222", weekday: 6 });
  });
});

describe("hata yönetimi", () => {
  it("biçimi bozuk <title> bloğu çökertmez, uyarıyla atlanır", () => {
    const synthetic = syntheticSvg(`
      <rect x="345" y="420" width="213.75" height="255" fill="transparent" stroke-width="0"><title>bu bir ders başlığı değil
Hoca
C101</title></rect>
      <rect x="558.75" y="420" width="213.75" height="255" fill="transparent" stroke-width="0"><title>CCC333-SEC-03-Geçerli Ders
Hoca C
C103</title></rect>
    `);

    const { rows, warnings } = parseEdupageTimetableSvg(synthetic);
    expect(rows).toHaveLength(1);
    expect(rows[0].courseCode).toBe("CCC333");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/KOD-SEC-NN/);
  });

  it("SVG grid'i hiç yoksa hata fırlatır (sessizce boş dönmez)", () => {
    const plain = "<html><body><table><tr><td>Pazartesi</td><td>ACL103</td></tr></table></body></html>";
    expect(() => parseEdupageTimetableSvg(plain)).toThrow(TimetableStructureError);
    expect(() => parseEdupageTimetableSvg(plain)).toThrow(/yapısı tanınmadı/);
  });

  it("SVG var ama saat başlığı yoksa hata fırlatır", () => {
    const noHeaders = `<html><body><svg>
      <rect x="345" y="420" width="213.75" height="255" fill="transparent" stroke-width="0"><title>DDD444-SEC-01-Ders
Hoca
C1</title></rect>
    </svg></body></html>`;
    expect(() => parseEdupageTimetableSvg(noHeaders)).toThrow(/saat başlığı/);
  });
});

/** Gerçek dosyanın saat başlıklarını taşıyan minimum bir SVG iskeleti. */
function syntheticSvg(inner: string): string {
  const headers = Array.from({ length: 12 }, (_, i) => {
    const x = 345 + i * 213.75 + 106.875;
    const startHour = 9 + i;
    return `<text x="${x}" y="335">${i + 1}.</text><text x="${x}" y="411.5">${startHour}:30 - ${startHour + 1}:20</text>`;
  }).join("");

  return `<html><body><svg width="860" height="608">${headers}${inner}</svg></body></html>`;
}
