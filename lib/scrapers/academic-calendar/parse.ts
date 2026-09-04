/**
 * Akademik takvim HTML'inin ayrıştırılması.
 *
 * Bu modül bilinçli olarak saf (pure) tutuldu: ağ/DB erişimi yok, bu yüzden
 * `server-only` de import edilmiyor — böylece Vitest içinden gerçek fixture
 * dosyalarıyla doğrudan test edilebiliyor. Ağ tarafı `fetch.ts`, DB tarafı
 * `diff.ts` içinde ve onlar `server-only` ile korunuyor.
 */
import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { hashRow } from "@/lib/scrapers/shared/hash";
import {
  classifyCalendarDescription,
  foldTurkish,
  type CalendarCategory,
} from "@/config/calendar-classification";

export type AcademicTerm = "guz" | "bahar" | "yaz";

export type ParsedAcademicCalendarRow = {
  term: AcademicTerm;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
  category: CalendarCategory;
  sourceHash: string;
};

export type ParseResult = {
  rows: ParsedAcademicCalendarRow[];
  warnings: string[];
};

/**
 * Türkçe ay adı → 0 tabanlı ay numarası.
 * Bilerek elle yazıldı: `date-fns` gibi bir kütüphanenin `tr` locale'i
 * bu tabloda görünen yazımla birebir aynı olmayabilir ve sessizce yanlış
 * ayrıştırma riski taşır. Anahtarlar `foldTurkish` ile sadeleştirilmiş hâlleridir.
 */
export const TURKISH_MONTHS: Record<string, number> = {
  ocak: 0,
  subat: 1,
  mart: 2,
  nisan: 3,
  mayis: 4,
  haziran: 5,
  temmuz: 6,
  agustos: 7,
  eylul: 8,
  ekim: 9,
  kasim: 10,
  aralik: 11,
};

/** `&nbsp;` dâhil tüm boşlukları normalleştirir. */
function normalizeCell(raw: string): string {
  return raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * "14 Eylül 2026 Pazartesi" → 2026-09-14 (UTC gece yarısı).
 * Sondaki gün adı gereksizdir, yok sayılır. Ayrıştırılamayan değerde `null` döner.
 */
export function parseTurkishDate(raw: string): Date | null {
  const text = normalizeCell(raw);
  if (!text) return null;

  const match = text.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = TURKISH_MONTHS[foldTurkish(match[2])];
  const year = Number(match[3]);

  if (month === undefined || !Number.isFinite(day) || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month, day));
  // 31 Şubat gibi taşan tarihleri yakala.
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

/** Sekme başlığından ("GÜZ DÖNEMİ" vb.) dönem kodunu çıkarır. */
export function termFromTabLabel(label: string): AcademicTerm | null {
  const folded = foldTurkish(label);
  if (folded.includes("guz")) return "guz";
  if (folded.includes("bahar")) return "bahar";
  if (folded.includes("yaz")) return "yaz";
  return null;
}

function isHeaderRow(cells: string[]): boolean {
  const first = foldTurkish(cells[0] ?? "");
  const second = foldTurkish(cells[1] ?? "");
  return first === "sno" || second.startsWith("baslangic tarihi");
}

/** Sekme çubuğu → { term, paneId } eşlemesi. */
function collectTabs($: CheerioAPI): Array<{ term: AcademicTerm; label: string; paneId: string | null }> {
  const tabs: Array<{ term: AcademicTerm; label: string; paneId: string | null }> = [];
  $("ul.nav-tabs li a").each((_, el) => {
    const label = normalizeCell($(el).text());
    const term = termFromTabLabel(label);
    if (!term) return;
    const href = $(el).attr("href") ?? "";
    const controls = $(el).attr("aria-controls") ?? "";
    const paneId = href.startsWith("#") ? href.slice(1) : controls || null;
    tabs.push({ term, label, paneId });
  });
  return tabs;
}

/**
 * Akademik takvim sayfasını satırlara çevirir.
 *
 * Tek bir bozuk satır tüm senkronizasyonu düşürmez; satır atlanır ve
 * `warnings` dizisine bir uyarı eklenir. Sadece sekme/tablo yapısının
 * tamamen bulunamaması durumunda hata fırlatılır — bu, sitenin yapısının
 * değiştiği anlamına gelir ve sessizce "0 kayıt" dönmek tehlikelidir.
 */
export function parseAcademicCalendarHtml(html: string, sourceYear: string): ParseResult {
  const $ = load(html);
  const warnings: string[] = [];
  const rows: ParsedAcademicCalendarRow[] = [];

  const tabs = collectTabs($);
  if (tabs.length === 0) {
    throw new Error(
      `Akademik takvim sayfasında dönem sekmeleri (ul.nav-tabs) bulunamadı (${sourceYear}). Site yapısı değişmiş olabilir.`
    );
  }

  const panes = $("div.tab-pane").toArray();
  let tablesFound = 0;

  tabs.forEach((tab, index) => {
    const pane = tab.paneId && $(`#${tab.paneId}`).length ? $(`#${tab.paneId}`) : $(panes[index]);
    if (!pane || pane.length === 0) {
      warnings.push(`[${sourceYear}/${tab.term}] "${tab.label}" sekmesinin içerik bloğu bulunamadı, atlandı.`);
      return;
    }

    const tableRows = pane.find("table tr").toArray();
    if (tableRows.length === 0) {
      warnings.push(`[${sourceYear}/${tab.term}] "${tab.label}" sekmesinde tablo satırı yok, atlandı.`);
      return;
    }
    tablesFound += 1;

    tableRows.forEach((tr, rowIndex) => {
      const cells = $(tr)
        .find("td, th")
        .map((_, td) => normalizeCell($(td).text()))
        .get();

      if (cells.length === 0) return;
      if (isHeaderRow(cells)) return;

      const where = `[${sourceYear}/${tab.term}] satır ${rowIndex + 1}`;

      if (cells.length < 4) {
        warnings.push(`${where}: beklenen 4 hücre yerine ${cells.length} hücre var, atlandı. (${cells.join(" | ")})`);
        return;
      }

      const [, rawStart, rawEnd, ...rest] = cells;
      const description = normalizeCell(rest.join(" "));

      if (!description) {
        warnings.push(`${where}: açıklama hücresi boş, atlandı.`);
        return;
      }

      const startDate = parseTurkishDate(rawStart);
      const endDate = parseTurkishDate(rawEnd);

      if (rawStart && !startDate) {
        warnings.push(`${where}: başlangıç tarihi çözümlenemedi ("${rawStart}"), boş kabul edildi. (${description})`);
      }
      if (rawEnd && !endDate) {
        warnings.push(`${where}: bitiş tarihi çözümlenemedi ("${rawEnd}"), boş kabul edildi. (${description})`);
      }

      // Gerçek veride tek günlük kayıtlarda boş hücre BAŞLANGIÇ ya da BİTİŞ
      // sütununda olabiliyor (DECISIONS.md). Hangisi doluysa tek gün odur;
      // ikisi de doluysa aralık, ikisi de boşsa satır atlanır.
      if (!startDate && !endDate) {
        warnings.push(`${where}: hem başlangıç hem bitiş tarihi boş, satır atlandı. (${description})`);
        return;
      }

      const category = classifyCalendarDescription(description);
      const sourceHash = hashRow([
        tab.term,
        startDate?.toISOString(),
        endDate?.toISOString(),
        description,
      ]);

      rows.push({ term: tab.term, startDate, endDate, description, category, sourceHash });
    });
  });

  if (tablesFound === 0) {
    throw new Error(
      `Akademik takvim sayfasında hiçbir sekmede tablo bulunamadı (${sourceYear}). Site yapısı değişmiş olabilir.`
    );
  }

  return { rows, warnings };
}
