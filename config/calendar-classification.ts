/**
 * Akademik takvim satırlarının kategori sınıflandırması (spesifikasyon §4.1).
 *
 * Bu dosya bilinçli olarak "kazıyıcı mantığından ayrı" tutuluyor: kategori
 * anahtar kelimeleri zamanla değişir (üniversite yeni bir ifade kullanmaya
 * başlar), bu yüzden kullanıcı `lib/scrapers/**` altındaki koda dokunmadan
 * sadece buradaki dizileri düzenleyebilmeli.
 *
 * Sunucuya özel bir şey içermez (DB/fetch yok) — bu yüzden `server-only`
 * import etmiyor ve testlerden doğrudan çağrılabiliyor.
 */

export type CalendarCategory = "SINAV" | "TATIL" | "DERS_DONEMI" | "KAYIT" | "IDARI";

/**
 * Türkçe metni eşleştirme için sadeleştirir: Türkçe karakterleri ASCII
 * karşılıklarına indirger, küçük harfe çevirir, kesme işaretlerini ve
 * boşlukları normalleştirir.
 *
 * Neden `toLocaleLowerCase("tr")` değil: "I/İ" davranışı platforma göre
 * sürprizli olabiliyor; burada karşılaştırma yaptığımız için harflerin
 * "doğru" Türkçe küçük hali değil, iki tarafta da *aynı* hale gelmesi önemli.
 * Bu yüzden hem metin hem anahtar kelime aynı fonksiyondan geçiriliyor.
 */
export function foldTurkish(input: string): string {
  const map: Record<string, string> = {
    ı: "i", İ: "i", I: "i", i: "i",
    ş: "s", Ş: "s",
    ğ: "g", Ğ: "g",
    ü: "u", Ü: "u",
    ö: "o", Ö: "o",
    ç: "c", Ç: "c",
    "’": "'", "‘": "'", "´": "'",
    "–": "-", "—": "-",
    " ": " ",
  };
  let out = "";
  for (const ch of input) {
    out += map[ch] ?? ch;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

/** İçinde herhangi biri geçiyorsa → SINAV */
export const SINAV_KEYWORDS: string[] = [
  "sınav",
  "APEX",
  "yeterlik",
  "mazeret sınav",
];

/** İçinde herhangi biri geçiyorsa → TATIL */
export const TATIL_KEYWORDS: string[] = [
  "bayram",
  "tatil",
  "yılbaşı",
  "Cumhuriyet Bayramı",
  "Atatürk'ü Anma",
  "23 Nisan",
  "19 Mayıs",
  "30 Ağustos",
  "Kurban Bayramı",
  "Ramazan Bayramı",
  "Zafer Bayramı",
  "Resmi Tatil",
];

/** İçinde herhangi biri geçiyorsa → DERS_DONEMI */
export const DERS_DONEMI_KEYWORDS: string[] = [
  "derslerin başlaması",
  "derslerin sona ermesi",
  "dönemin başlaması",
  "dönemin sona ermesi",
  // Gerçek 2026-2027 tablosunda geçen çekimli varyantlar
  // (örn. "Güz dönemi derslerinin başlaması - sona ermesi"):
  "derslerinin başlaması",
  "derslerinin sona ermesi",
  "dönemin başladığı",
  "dersleri başlaması",
];

/** İçinde herhangi biri geçiyorsa → KAYIT */
export const KAYIT_KEYWORDS: string[] = [
  "ders kayıt",
  "ekle-bırak",
  "ekle bırak",
  "danışman onayı",
  "danışman onayları",
  "kesin kayıt",
];

/**
 * Sıra önemlidir: ilk eşleşen kategori kazanır. (Örn. "Sınav Programı
 * Hazırlama Ofisi" ifadesi geçen idari bir satır, "sınav" kelimesi
 * yüzünden SINAV sayılır — kural tabanlı sınıflandırmanın bilinen ve
 * kabul edilen sonucu; yanlışsa panelden `category_override` ile düzeltilir.)
 */
export const CLASSIFICATION_RULES: Array<{
  category: Exclude<CalendarCategory, "IDARI">;
  keywords: string[];
}> = [
  { category: "SINAV", keywords: SINAV_KEYWORDS },
  { category: "TATIL", keywords: TATIL_KEYWORDS },
  { category: "DERS_DONEMI", keywords: DERS_DONEMI_KEYWORDS },
  { category: "KAYIT", keywords: KAYIT_KEYWORDS },
];

/** Hiçbir kurala uymayan satırların kategorisi. */
export const FALLBACK_CATEGORY: CalendarCategory = "IDARI";

/**
 * Bir akademik takvim satırının Türkçe açıklamasını kategoriye eşler.
 * Büyük/küçük harf ve Türkçe karakter farklarına duyarsızdır.
 */
export function classifyCalendarDescription(description: string): CalendarCategory {
  const haystack = foldTurkish(description);
  if (!haystack) return FALLBACK_CATEGORY;

  for (const rule of CLASSIFICATION_RULES) {
    for (const keyword of rule.keywords) {
      const needle = foldTurkish(keyword);
      if (needle && haystack.includes(needle)) {
        return rule.category;
      }
    }
  }
  return FALLBACK_CATEGORY;
}
