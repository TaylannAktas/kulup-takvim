/**
 * Sol panel başlıklarındaki ("Ders Programı"/"Sınav Programı"/"Akademik
 * Takvim") ana tik kutusu — bütün bir kategoriyi takvimden gizler/gösterir.
 *
 * Alt filtrelerin (fakülte/tür çipleri, "Sınıflar" seçimi) aksine BOŞ katman
 * kümesi "hiçbir şey görünmüyor" değil, "hiçbir şey GİZLENMEMİŞ" anlamına
 * gelir — yani varsayılan (URL'de hiçbir şey yokken, ilk ziyarette) üç
 * kategori de AÇIK. `server-only` OLMAYAN ayrı bir dosyada tutuluyor ki
 * istemci bileşenleri (checkbox) `lib/db`'yi build'e sürüklemesin —
 * `course-layers.ts` ile aynı gerekçe/desen.
 */
export const CATEGORY_NAMESPACE = "category-hidden";

export type CategoryKey = "course" | "exam" | "academic";

export function categoryHiddenLayerId(category: CategoryKey): string {
  return `${CATEGORY_NAMESPACE}:${category}`;
}
