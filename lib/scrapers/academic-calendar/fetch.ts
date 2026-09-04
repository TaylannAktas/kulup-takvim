import "server-only";
import { load } from "cheerio";
import { fetchHtml, resolveUrl } from "@/lib/scrapers/shared/http-client";
import { foldTurkish } from "@/config/calendar-classification";

/**
 * Akademik takvim sayfasının iki aşamalı keşfi (DECISIONS.md, 2026-09-04).
 *
 * 1. OİM sayfasından "Akademik Takvim {yıl}" bağlantısı bulunur.
 * 2. O yıl sayfası TABLOYU İÇERMEZ — program grubu bağlantılarını listeler.
 *    İçlerinden "Önlisans, Lisans Akademik Takvimi (Tıp Fakültesi hariç)"
 *    bağlantısı bulunur ve asıl tablo o sayfadan çekilir.
 *
 * `page/6951/...` gibi sayısal ID'ler yıldan yıla değiştiği için hiçbir yerde
 * sabit yazılmaz; her çalıştırmada yeniden keşfedilir. Emin olunan tek bir
 * eşleşme yoksa tahmin yürütülmez, açıklayıcı bir hata fırlatılır
 * (bu hata `sync_runs.status = 'hata'` + `errorDetail` olarak kaydedilir).
 */

export const OIM_INDEX_URL = "https://www.atilim.edu.tr/tr/oim";

type LinkCandidate = { text: string; url: string };

function collectLinks(html: string, baseUrl: string): LinkCandidate[] {
  const $ = load(html);
  const links: LinkCandidate[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    try {
      links.push({ text, url: resolveUrl(baseUrl, href) });
    } catch {
      // Çözümlenemeyen (bozuk) href — yok say.
    }
  });
  return links;
}

/** Aynı URL'e giden birden fazla bağlantıyı teke indirir. */
function uniqueByUrl(candidates: LinkCandidate[]): LinkCandidate[] {
  const seen = new Map<string, LinkCandidate>();
  for (const candidate of candidates) {
    if (!seen.has(candidate.url)) seen.set(candidate.url, candidate);
  }
  return [...seen.values()];
}

function pickSingle(candidates: LinkCandidate[], what: string, contextUrl: string): LinkCandidate {
  const unique = uniqueByUrl(candidates);
  if (unique.length === 0) {
    throw new Error(`Akademik takvim keşfi: ${what} bulunamadı (kaynak: ${contextUrl}). Site yapısı değişmiş olabilir.`);
  }
  if (unique.length > 1) {
    const list = unique.map((c) => `"${c.text}" -> ${c.url}`).join(", ");
    throw new Error(
      `Akademik takvim keşfi: ${what} için ${unique.length} olası bağlantı bulundu, tahmin yürütülmedi (kaynak: ${contextUrl}). Adaylar: ${list}`
    );
  }
  return unique[0];
}

/**
 * Yıl sayfası bağlantısını bulur (örn. "Akademik Takvim 2026-2027").
 * Test edilebilirlik için dışa açık; ağ erişimi yapmaz.
 */
export function findYearPageLink(html: string, baseUrl: string, year: string): LinkCandidate[] {
  const foldedYear = foldTurkish(year);
  return collectLinks(html, baseUrl).filter((link) => {
    const text = foldTurkish(link.text);
    return text.includes("akademik takvim") && text.includes(foldedYear);
  });
}

/**
 * Yıl sayfasındaki program grubu bağlantılarından bizim kapsamımızdakini bulur:
 * "Önlisans, Lisans Akademik Takvimi (Tıp Fakültesi hariç)".
 *
 * DİKKAT: hedef bağlantının metninde "Tıp Fakültesi" ifadesi **geçiyor**
 * ("... hariç" olarak). Bu yüzden "tıp" içeren her bağlantıyı elemek yanlış
 * olur; sadece "hariç" geçmeyenler (yani gerçekten Tıp Fakültesi takvimi
 * olanlar) elenir. Lisansüstü takvimi de "önlisans" içermediği için düşer.
 */
export function findProgramGroupLink(html: string, baseUrl: string): LinkCandidate[] {
  return collectLinks(html, baseUrl).filter((link) => {
    const text = foldTurkish(link.text);
    if (!text.includes("akademik takvim")) return false;
    if (!text.includes("onlisans")) return false;
    if (!text.includes("lisans")) return false;
    if (text.includes("tip fakultesi") && !text.includes("haric")) return false;
    return true;
  });
}

/** OİM sayfasında yıl bağlantısı yoksa gidilecek ara "Akademik Takvim" sayfası. */
function findCalendarHubLink(html: string, baseUrl: string): LinkCandidate[] {
  return collectLinks(html, baseUrl).filter((link) => {
    const text = foldTurkish(link.text);
    return text === "akademik takvim" && /akademik-takvim/i.test(link.url);
  });
}

export type DiscoveredCalendarPage = {
  html: string;
  sourceUrl: string;
  /** Keşif zinciri: hangi sayfalardan geçildiği (log/hata ayıklama için). */
  trail: string[];
};

/**
 * Verilen akademik yıl için ("2026-2027") tablo içeren sayfayı keşfeder ve indirir.
 */
export async function discoverAndFetchAcademicCalendarPage(
  year: string,
  options?: { entryUrl?: string }
): Promise<DiscoveredCalendarPage> {
  const entryUrl = options?.entryUrl ?? OIM_INDEX_URL;
  const trail: string[] = [entryUrl];

  const entryHtml = await fetchHtml(entryUrl);
  let yearCandidates = findYearPageLink(entryHtml, entryUrl, year);

  // 1a. Yıl bağlantısı doğrudan OİM sayfasında yoksa, "Akademik Takvim"
  //     ara sayfasına bir kez atlanır (DECISIONS.md'deki gezinme yolu).
  if (yearCandidates.length === 0) {
    const hub = findCalendarHubLink(entryHtml, entryUrl);
    if (hub.length > 0) {
      const hubUrl = uniqueByUrl(hub)[0].url;
      trail.push(hubUrl);
      const hubHtml = await fetchHtml(hubUrl);
      yearCandidates = findYearPageLink(hubHtml, hubUrl, year);
    }
  }

  const yearLink = pickSingle(yearCandidates, `"${year}" akademik yılının takvim sayfası`, trail[trail.length - 1]);
  trail.push(yearLink.url);

  // 2. Yıl sayfası tabloyu içermez; program grubu bağlantısı bulunur.
  const yearHtml = await fetchHtml(yearLink.url);
  const programLink = pickSingle(
    findProgramGroupLink(yearHtml, yearLink.url),
    "Önlisans/Lisans akademik takvimi (Tıp Fakültesi hariç) bağlantısı",
    yearLink.url
  );
  trail.push(programLink.url);

  const html = await fetchHtml(programLink.url);
  return { html, sourceUrl: programLink.url, trail };
}
