/**
 * Sınav programı kaynağının indirilmesi ve keşfi.
 *
 * İki ayrı sorumluluk var:
 *
 * 1. **Frameset indirme** (`fetchExamScheduleFrameset`) — kaynak sayfa Excel'in
 *    "web sayfası olarak kaydet" çıktısı: kök URL bir `<frameset>` döndürüyor,
 *    asıl veri `name="frSheet"` çerçevesindeki `index_files/sheet001.htm`
 *    dosyasında (DECISIONS.md, 2026-09-04). Kök URL ayrıca **301 redirect**
 *    veriyor; `fetchHtml` zaten `redirect: "follow"` kullandığı için ek bir şey
 *    yapmaya gerek yok.
 *
 * 2. **Keşif** (`discoverExamScheduleLinks`) — `https://www.atilim.edu.tr/tr/dersprogrami`
 *    sayfasındaki sınav programı bağlantılarını ayıklama.
 *
 * Ayrıştırma fonksiyonları (`findSheetFrameSrc`, `parseExamScheduleUrl`,
 * `discoverExamScheduleLinks`) ağ erişimi yapmaz; testlerden doğrudan
 * çağrılabilsin diye dışa açık. Ağ erişimi yapan tek fonksiyon
 * `fetchExamScheduleFrameset`.
 */
import "server-only";
import { load } from "cheerio";
import { fetchHtml, fetchHtmlWithFinalUrl, resolveUrl } from "@/lib/scrapers/shared/http-client";

export const EXAM_SCHEDULE_INDEX_URL = "https://www.atilim.edu.tr/tr/dersprogrami";

export const EXAM_SCHEDULE_HOST = "dersprogramiyukle.atilim.edu.tr";

export type ExamType = "arasinav" | "final" | "mazeret";

/**
 * Spesifikasyondaki fakülte kısaltmaları. Kaynak sitede eski dönemlere ait
 * `muhendislik`, `müh`, `sbf`, `myosaglik` gibi başka kısaltmalar da var;
 * v1 kapsamı bilinçli olarak bu listeyle sınırlı — tanınmayan bir kısaltma
 * "yeni fakülte keşfettik" diye sessizce içeri alınmıyor.
 */
export const FACULTY_CODES = [
  "servis",
  "muh",
  "isletme",
  "cav",
  "fef",
  "saglik",
  "shmyo",
  "gsmf",
  "gsod",
  "etp",
  "hukuk",
  "pilotaj",
] as const;

/**
 * Sınav türü anahtar kelimeleri. Sıra önemli: "arasinav" içinde "sinav" geçtiği
 * için önce en uzun/en özel olan denenir.
 */
const EXAM_TYPE_KEYWORDS: Array<{ keyword: string; examType: ExamType }> = [
  { keyword: "arasinav", examType: "arasinav" },
  { keyword: "mazeret", examType: "mazeret" },
  { keyword: "final", examType: "final" },
];

export type DiscoveredExamSchedule = {
  termCode: string;
  examType: ExamType;
  facultyCode: string;
  url: string;
};

/**
 * `<frame name="frSheet">` çerçevesinin `src` değerini bulur.
 *
 * Not: kök sayfanın `<script>` bloğu içinde de (eski IE için frameset'i JS ile
 * kuran kod) "frSheet" dizesi geçiyor. Bu yüzden regex değil cheerio kullanılıyor;
 * script içeriği ham metin olarak ayrıştırıldığı için oradaki dizeyi yanlışlıkla
 * yakalamıyoruz.
 */
export function findSheetFrameSrc(html: string): string | null {
  const $ = load(html);

  const named = $('frame[name="frSheet"]').attr("src");
  if (named) return named;

  // Geri düşüş: `name` niteliği yoksa ilk `<frame>` veri çerçevesi kabul edilir
  // (tabstrip her zaman ikinci sırada geliyor).
  const first = $("frame").first().attr("src");
  return first ?? null;
}

/**
 * Kök URL'i indirir, `frSheet` çerçevesini çözer ve asıl veri sayfasını indirir.
 * İki ağ isteği yapar (`fetchHtml` istekler arasında zaten gecikme uyguluyor).
 *
 * DİKKAT: kök URL 301 ile yönlendiriliyor ve yönlendirme hedefi sonunda `/`
 * içeriyor (örn. `.../20252026guzarasinav/muh` -> `.../muh/`). Frame'in
 * relatif `src`'ini ORİJİNAL `rootUrl`'e göre çözmek, temel URL'de son
 * segmentten sonra `/` olmadığı için o segmenti (`muh`) düşürüyor — sonuç
 * `.../20252026guzarasinav/index_files/sheet001.htm` gibi yanlış (fakülte
 * segmentsiz) bir URL oluyor ve 404 veriyor. Bu, canlıda tüm sınav programı
 * senkronunu (120/120) sessizce başarısız kılan gerçek bir hataydı — çözüm:
 * relatif bağlantıyı YÖNLENDİRME SONRASI nihai URL'e göre çöz.
 */
export async function fetchExamScheduleFrameset(
  rootUrl: string
): Promise<{ sheetHtml: string; sheetUrl: string }> {
  const { html: rootHtml, finalUrl: rootFinalUrl } = await fetchHtmlWithFinalUrl(rootUrl);
  const frameSrc = findSheetFrameSrc(rootHtml);

  if (!frameSrc) {
    throw new Error(
      `Sınav programı frameset'inde veri çerçevesi (frSheet) bulunamadı: ${rootUrl}. Kaynak sayfanın yapısı değişmiş olabilir.`
    );
  }

  const sheetUrl = resolveUrl(rootFinalUrl, frameSrc);
  const sheetHtml = await fetchHtml(sheetUrl);
  return { sheetHtml, sheetUrl };
}

/**
 * `dersprogramiyukle.atilim.edu.tr/{donem}{tur}/{fakulte}` biçimindeki bir URL'i
 * bileşenlerine ayırır. Tanınmayan bir biçimde `null` döner (tahmin yürütülmez).
 *
 * Kaynak sitede iki sıralama birden görülüyor:
 *   - `20252026guzarasinav/muh`   (dönem + tür)
 *   - `20232024arasinavbahar/muh` (tür + dönem)
 * İkisi de aynı `termCode`'a indirgeniyor: sınav türü dizesi ilk yol
 * parçasından çıkarılıp geri kalanı dönem kodu kabul ediliyor
 * ("20252026guz" / "20232024bahar").
 *
 * Sınav türü içermeyen bağlantılar (`20252026guz/pilotaj` gibi ders programları)
 * ve tanınmayan fakülte kısaltmaları eleniyor.
 */
export function parseExamScheduleUrl(url: string): DiscoveredExamSchedule | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname.toLowerCase() !== EXAM_SCHEDULE_HOST) return null;

  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length !== 2) return null;

  const [rawTermSegment, rawFacultySegment] = segments;
  const termSegment = rawTermSegment.toLowerCase();
  const facultyCode = rawFacultySegment.toLowerCase();

  if (!(FACULTY_CODES as readonly string[]).includes(facultyCode)) return null;

  // İlk parça `{8 haneli yıl}...` ile başlamalı (örn. "20252026").
  const yearMatch = termSegment.match(/^(\d{8})(.*)$/);
  if (!yearMatch) return null;

  const [, years, rest] = yearMatch;

  const hit = EXAM_TYPE_KEYWORDS.find((candidate) => rest.includes(candidate.keyword));
  if (!hit) return null;

  const term = rest.replace(hit.keyword, "");
  if (!term) return null;

  return {
    termCode: `${years}${term}`,
    examType: hit.examType,
    facultyCode,
    url: `${parsed.origin}/${termSegment}/${facultyCode}`,
  };
}

/**
 * Keşif sayfasındaki sınav programı bağlantılarını ayıklar.
 *
 * Bilinçli olarak "sitedeki her sınav sayfasını gez" tarzı bir gezgin (crawler)
 * değil: yalnızca verilen HTML'deki bağlantıları çözümlüyor. Ağ erişimi yok.
 * Aynı hedefe giden birden fazla bağlantı teke indiriliyor.
 */
export function discoverExamScheduleLinks(
  html: string,
  baseUrl: string
): DiscoveredExamSchedule[] {
  const $ = load(html);
  const found = new Map<string, DiscoveredExamSchedule>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let absolute: string;
    try {
      absolute = resolveUrl(baseUrl, href);
    } catch {
      return;
    }

    const parsed = parseExamScheduleUrl(absolute);
    if (!parsed) return;
    if (!found.has(parsed.url)) found.set(parsed.url, parsed);
  });

  return [...found.values()];
}
