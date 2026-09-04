import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseAcademicCalendarHtml,
  parseTurkishDate,
  termFromTabLabel,
  type ParsedAcademicCalendarRow,
} from "@/lib/scrapers/academic-calendar/parse";
import { classifyCalendarDescription } from "@/config/calendar-classification";
import { findProgramGroupLink, findYearPageLink } from "@/lib/scrapers/academic-calendar/fetch";

/**
 * Gerçek (canlı siteden indirilmiş) fixture ile ayrıştırıcı testleri.
 * Ağ erişimi yok; dosya `node:fs` ile okunuyor.
 *
 * Sayfa ID'leri (6946 = yıl sayfası, 6951 = önlisans/lisans tablosu) sadece
 * burada, okunabilirlik için sabit — kazıyıcı bunları her çalıştırmada
 * yeniden keşfediyor (bkz. DECISIONS.md).
 */
const FIXTURE_PAGE_ID = 6951;
const SOURCE_YEAR = "2026-2027";

const fixtureUrl = new URL(
  "../../../fixtures/academic-calendar/sample-2026-2027-onlisans-lisans.html",
  import.meta.url
);
const html = readFileSync(fileURLToPath(fixtureUrl), "utf8");

const { rows, warnings } = parseAcademicCalendarHtml(html, SOURCE_YEAR);

function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Fixture'da bazı açıklamalar birden fazla dönemde tekrar ediyor
 * (örn. "Kurban Bayramı" hem güz hem bahar sekmesinde var), bu yüzden
 * arama dönemle birlikte yapılıyor.
 */
function findRow(needle: string, term: ParsedAcademicCalendarRow["term"] = "guz"): ParsedAcademicCalendarRow {
  const matches = rows.filter((row) => row.term === term && row.description.includes(needle));
  expect(matches, `"${needle}" (${term}) içeren tek satır bulunamadı`).toHaveLength(1);
  return matches[0];
}

describe(`akademik takvim ayrıştırıcı (gerçek fixture, page/${FIXTURE_PAGE_ID})`, () => {
  it("üç dönemin de satırlarını bulur", () => {
    const terms = new Set(rows.map((row) => row.term));
    expect(terms).toEqual(new Set(["guz", "bahar", "yaz"]));

    for (const term of ["guz", "bahar", "yaz"] as const) {
      expect(rows.filter((row) => row.term === term).length).toBeGreaterThan(0);
    }

    // Fixture'daki gerçek satır sayıları (başlık satırları hariç).
    expect(rows.filter((row) => row.term === "guz")).toHaveLength(65);
    expect(rows.filter((row) => row.term === "bahar")).toHaveLength(48);
    expect(rows.filter((row) => row.term === "yaz")).toHaveLength(17);
    expect(rows).toHaveLength(130);
  });

  it("gerçek fixture'da uyarı üretmez (tüm satırlar temiz ayrıştırılıyor)", () => {
    expect(warnings).toEqual([]);
  });

  it("iki tarihi de dolu satırı aralık olarak ayrıştırır", () => {
    const row = findRow("Kurban Bayramı");
    expect(row.term).toBe("guz");
    expect(row.description).toBe("Kurban Bayramı (26 Mayıs 2026 Salı yarım gün)");
    expect(iso(row.startDate)).toBe("2026-05-27");
    expect(iso(row.endDate)).toBe("2026-05-30");
    expect(row.category).toBe("TATIL");
  });

  it("BAŞLANGIÇ hücresi boş satırı tek günlük olarak (bitiş tarihiyle) ayrıştırır", () => {
    // DECISIONS.md'deki gerçek sürpriz: boş hücre BİTİŞ'te değil BAŞLANGIÇ'ta.
    const row = findRow("Güz dönemi açılacak derslerin Ders ve Sınav Programı");
    expect(row.term).toBe("guz");
    expect(row.startDate).toBeNull();
    expect(iso(row.endDate)).toBe("2026-07-03");
    expect(row.description).toBe(
      "Güz dönemi açılacak derslerin Ders ve Sınav Programı Hazırlama Ofisine iletilmesinin son günü"
    );
    // "Sınav Programı Hazırlama Ofisi" ifadesi yüzünden SINAV'a düşüyor:
    // anahtar kelime tabanlı sınıflandırmanın bilinen sonucu, panelden
    // category_override ile düzeltilebilir.
    expect(row.category).toBe("SINAV");
  });

  it("BİTİŞ hücresi boş satırı tek günlük olarak (başlangıç tarihiyle) ayrıştırır", () => {
    const row = findRow("Cumhuriyet Bayramı");
    expect(row.term).toBe("guz");
    expect(iso(row.startDate)).toBe("2026-10-29");
    expect(row.endDate).toBeNull();
    expect(row.category).toBe("TATIL");
  });

  it("ders dönemi ve sınav satırlarını doğru sınıflandırır", () => {
    const dersSonu = findRow("Derslerin sona ermesi");
    expect(dersSonu.startDate).toBeNull();
    expect(iso(dersSonu.endDate)).toBe("2026-12-21");
    expect(dersSonu.category).toBe("DERS_DONEMI");

    const donemAraligi = findRow("Güz dönemi derslerinin başlaması - sona ermesi");
    expect(iso(donemAraligi.startDate)).toBe("2026-09-14");
    expect(iso(donemAraligi.endDate)).toBe("2026-12-21");
    expect(donemAraligi.category).toBe("DERS_DONEMI");

    const apex = findRow("Temel İngilizce Bölümü Yeterlik Sınavı (APEX)");
    expect(iso(apex.startDate)).toBe("2027-01-25");
    expect(apex.endDate).toBeNull();
    expect(apex.category).toBe("SINAV");

    const kayit = findRow("Güz dönemi ders kayıtları ve danışman onayları");
    expect(iso(kayit.startDate)).toBe("2026-09-09");
    expect(iso(kayit.endDate)).toBe("2026-09-11");
    expect(kayit.category).toBe("KAYIT");

    const yilbasi = findRow("Yılbaşı tatili");
    expect(iso(yilbasi.startDate)).toBe("2027-01-01");
    expect(yilbasi.category).toBe("TATIL");

    const idari = findRow("Dönem izni (kayıt dondurma) başvuruları");
    expect(idari.category).toBe("IDARI");
  });

  it("her satır için kararlı ve ayırt edici bir sourceHash üretir", () => {
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.sourceHash))).toBe(true);
    const hashes = new Set(rows.map((row) => `${row.term}::${row.sourceHash}`));
    expect(hashes.size).toBe(rows.length);
  });
});

describe("Türkçe tarih ayrıştırıcı", () => {
  it("tam ay adlarını ve gereksiz gün adını doğru çözer", () => {
    expect(iso(parseTurkishDate("14 Eylül 2026 Pazartesi"))).toBe("2026-09-14");
    expect(iso(parseTurkishDate("1 Ocak 2027 Cuma"))).toBe("2027-01-01");
    expect(iso(parseTurkishDate("30 Ağustos 2026 Pazar"))).toBe("2026-08-30");
    expect(iso(parseTurkishDate("21 Aralık 2026 Pazartesi"))).toBe("2026-12-21");
    // Gün adı olmadan da çalışmalı
    expect(iso(parseTurkishDate("3 Şubat 2027"))).toBe("2027-02-03");
  });

  it("12 Türkçe ay adının hepsini tanır", () => {
    const months = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ];
    months.forEach((name, index) => {
      const parsed = parseTurkishDate(`5 ${name} 2026`);
      expect(parsed, `${name} çözülemedi`).not.toBeNull();
      expect(parsed?.getUTCMonth()).toBe(index);
    });
  });

  it("boş / geçersiz değerlerde null döner", () => {
    expect(parseTurkishDate("")).toBeNull();
    expect(parseTurkishDate(" ")).toBeNull();
    expect(parseTurkishDate("BAŞLANGIÇ TARİHİ")).toBeNull();
    expect(parseTurkishDate("31 Şubat 2026 Salı")).toBeNull();
  });
});

describe("sekme başlığı → dönem eşlemesi", () => {
  it("gerçek sekme etiketlerini çözer", () => {
    expect(termFromTabLabel("GÜZ DÖNEMİ")).toBe("guz");
    expect(termFromTabLabel("BAHAR DÖNEMİ")).toBe("bahar");
    expect(termFromTabLabel("YAZ ÖĞRETİMİ")).toBe("yaz");
    expect(termFromTabLabel("TIP FAKÜLTESİ")).toBeNull();
  });
});

describe("bozuk satır dayanıklılığı", () => {
  const malformedHtml = `
    <ul class="nav nav-tabs" role="tablist">
      <li><a href="#pane-guz" role="tab">GÜZ DÖNEMİ</a></li>
    </ul>
    <div class="tab-content">
      <div role="tabpanel" class="tab-pane" id="pane-guz">
        <table>
          <tbody>
            <tr><td><strong>SNO</strong></td><td><strong>BAŞLANGI&Ccedil; TARİHİ</strong></td><td><strong>BİTİŞ TARİHİ</strong></td><td><strong>A&Ccedil;IKLAMA</strong></td></tr>
            <tr><td>1</td><td>&nbsp;</td><td>&nbsp;</td><td>Tarihi belirlenmemiş idari kayıt</td></tr>
            <tr><td>2</td><td>14 Eyl&uuml;l 2026 Pazartesi</td><td>&nbsp;</td><td>Derslerin başlaması</td></tr>
            <tr><td>3</td><td>15 Eyl&uuml;l 2026 Salı</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  it("iki tarihi de boş olan satırı çökmeden atlar ve uyarı toplar", () => {
    const result = parseAcademicCalendarHtml(malformedHtml, SOURCE_YEAR);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe("Derslerin başlaması");
    expect(iso(result.rows[0].startDate)).toBe("2026-09-14");
    expect(result.rows[0].category).toBe("DERS_DONEMI");

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("hem başlangıç hem bitiş tarihi boş");
    expect(result.warnings[0]).toContain("Tarihi belirlenmemiş idari kayıt");
    expect(result.warnings[1]).toContain("beklenen 4 hücre yerine 2 hücre");
  });

  it("sekme/tablo yapısı tamamen yoksa hata fırlatır", () => {
    expect(() => parseAcademicCalendarHtml("<html><body><p>yok</p></body></html>", SOURCE_YEAR)).toThrow(
      /dönem sekmeleri/
    );
    expect(() =>
      parseAcademicCalendarHtml(
        '<ul class="nav nav-tabs"><li><a href="#x">GÜZ DÖNEMİ</a></li></ul><div class="tab-pane" id="x"></div>',
        SOURCE_YEAR
      )
    ).toThrow(/tablo bulunamadı/);
  });
});

describe("iki aşamalı keşif (gerçek fixture'lar, ağ erişimi yok)", () => {
  const OIM_URL = "https://www.atilim.edu.tr/tr/oim";
  const YEAR_PAGE_ID = 6946;

  const readFixture = (name: string) =>
    readFileSync(fileURLToPath(new URL(`../../../fixtures/academic-calendar/${name}`, import.meta.url)), "utf8");

  it("OİM sayfasından tek bir yıl sayfası bağlantısı bulur", () => {
    const matches = findYearPageLink(readFixture("oim-discovery-index.html"), OIM_URL, SOURCE_YEAR);
    const urls = [...new Set(matches.map((m) => m.url))];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/oim/page/${YEAR_PAGE_ID}/akademik-takvim-2026-2027`);
  });

  it("başka bir yıl istendiğinde o yılın sayfasını seçer", () => {
    const matches = findYearPageLink(readFixture("oim-discovery-index.html"), OIM_URL, "2024-2025");
    const urls = [...new Set(matches.map((m) => m.url))];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("akademik-takvim-2024-2025");
  });

  it("yıl sayfasından 'Önlisans, Lisans (Tıp Fakültesi hariç)' bağlantısını seçer", () => {
    // Tuzak: hedef bağlantının metninde "Tıp Fakültesi" ifadesi *geçiyor*
    // ("... hariç"). Sadece "tıp" geçenleri elemek yanlış sonuç verirdi.
    const yearPageUrl = `${OIM_URL}/page/${YEAR_PAGE_ID}/akademik-takvim-2026-2027`;
    const matches = findProgramGroupLink(readFixture("sample-2026-2027-year-index.html"), yearPageUrl);
    const urls = [...new Set(matches.map((m) => m.url))];

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/oim/page/${FIXTURE_PAGE_ID}/`);
    expect(matches[0].text).toContain("Önlisans");
    expect(matches[0].text).toContain("hariç");
  });

  it("Tıp Fakültesi ve Lisansüstü takvimlerini seçmez", () => {
    const html = `
      <a href="/oim/page/6951/onlisans">Önlisans, Lisans Akademik Takvimi (Tıp Fakültesi hariç)</a>
      <a href="/oim/page/6953/tip">Tıp Fakültesi Akademik Takvimi</a>
      <a href="/oim/page/6952/lisansustu">Lisansüstü Programlar Akademik Takvimi</a>
      <a href="/oim/page/6981/azami">Azami Süre Ek Sınav Takvimi</a>`;
    const matches = findProgramGroupLink(html, OIM_URL);
    expect(matches).toHaveLength(1);
    expect(matches[0].url).toContain("/page/6951/");
  });
});

describe("sınıflandırıcı (config/calendar-classification.ts)", () => {
  it("büyük/küçük harf ve Türkçe karakter farkına duyarsızdır", () => {
    expect(classifyCalendarDescription("RAMAZAN BAYRAMI")).toBe("TATIL");
    expect(classifyCalendarDescription("ingilizce yeterlik sinavi")).toBe("SINAV");
    expect(classifyCalendarDescription("Ekle-Bırak haftası")).toBe("KAYIT");
    expect(classifyCalendarDescription("Mezuniyet töreni")).toBe("IDARI");
  });
});
